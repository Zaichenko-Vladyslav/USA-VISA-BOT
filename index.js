import cheerio from 'cheerio';
import fetch from "node-fetch";
import sgMail from '@sendgrid/mail';

const USERNAME = ''
const PASSWORD = ''
const SCHEDULE_ID = ''
const REGION = 'ca'
const BASE_URL = 'https://ais.usvisa-info.com/en-ca/niv'
const NOTIFICATION_EMAIL = ''

sgMail.setApiKey('');

const listOfEmbassies = [
  { id: 89, name: "Calgary" },
  { id: 90, name: "Halifax" },
  { id: 91, name: "Montreal" },
  { id: 92, name: "Ottawa" },
  { id: 93, name: "Quebec City" },
  { id: 94, name: "Toronto" },
  { id: 95, name: "Vancouver" },
];

let bestAvailableEmbassy = null;
let bestAvailableDate = null;
let bestAvailableTime = null;

async function main(currentAppointmentDate) {

  if (!currentAppointmentDate) {
    console.log(`Invalid current appointment date: ${currentAppointmentDate}`)
    process.exit(1)
  }

  console.log(`Current appointment date: ${currentAppointmentDate}`)

  try {

    while (!bestAvailableDate) {

      const sessionHeaders = await authentication()

      console.log('Authentication process - OK')

      for (const {id, name: embassy_name} of listOfEmbassies) {

        const date = await findAvailableDate(sessionHeaders, id);
  
        if (!date) {
          console.log(`Embassy: ${embassy_name}. Status: No available dates found!`);
        } else if (date > currentAppointmentDate) {
          console.log(`Embassy: ${embassy_name}. Status: Nearest date ${date} is further than already booked!`);
        } else {
  
          const time = await findAvailableTime(sessionHeaders, date, id);
  
          console.log(`Embassy - ${embassy_name}. Status: Closest date and time: ${date} (${time})`);
          
          if (!bestAvailableDate || (date < bestAvailableDate)) {
            bestAvailableEmbassy = embassy_name;
            bestAvailableDate = date;
            bestAvailableTime = time;
          }
        }
      }

      console.log('Wait for ' + 5 + ' minutes!')
      await sleep(60 * 5);
    }

    if (bestAvailableDate) {

      const emailContent = `Best available date across all embassies found! Embassy: ${bestAvailableEmbassy}, date and time: ${bestAvailableDate} (${bestAvailableTime})`;
      console.log(emailContent);

      const message = {
        to: NOTIFICATION_EMAIL,
        from: NOTIFICATION_EMAIL,
        subject: 'USA VISA Appointment available date found!',
        text: emailContent,
      }

      sgMail.send(message)
        .then((response) => {
          console.log(response[0].statusCode)
          console.log(response[0].headers)
        })
        .catch(error => log(`Error sending email: ${error.message}`));

      console.log(bestAvailableDate, bestAvailableTime)

      // Book New Appointment
      console.log('Attempt to book new appointment!')
      bookAppointment(sessionHeaders, bestAvailableDate, bestAvailableTime)
        .then(d => console.log(`New appointent booked! Date and time: ${bestAvailableDate} (${bestAvailableTime})`))

    } else {
      console.log('Unfortunately, no available dates found!');
    }

    console.log('Process - DONE!')

  } catch (error) {
    console.error(error)
    main(currentAppointmentDate)
  }
}

async function authentication() {

  console.log(`Authentication process started`);

  const anonymousHeaders = await fetch(`${BASE_URL}/users/sign_in`)
    .then(response => extractHeaders(response));

  const response = await fetch(`${BASE_URL}/users/sign_in`, {
    method: "POST",
    headers: {
      ...anonymousHeaders,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({
      'utf8': '✓',
      'user[email]': USERNAME,
      'user[password]': PASSWORD,
      'policy_confirmed': '1',
      'commit': 'Sign In'
    }),
  });

  if (!response.ok) {
    throw new Error('Authentication process failed');
  }

  const authenticatedHeaders = {
    ...anonymousHeaders,
    'Cookie': extractRelevantCookies(response),
  };

  return authenticatedHeaders;
}

async function extractHeaders(response) {

  try {
    const cookies = extractRelevantCookies(response);
    const html = await response.text();
    const tokenCSRF = extractCSRFToken(html);

    return {
      "Cookie": cookies,
      "X-CSRF-Token": tokenCSRF,
      "Referer": BASE_URL,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive'
    };
  } catch (error) {
    console.error("Error extracting headers: ", error.message);
    throw error;
  }
}

function extractCSRFToken(html) {

  const $ = cheerio.load(html);
  const tokenCSFT = $('meta[name="csrf-token"]').attr('content');

  if (!tokenCSFT) {
    throw new Error("CSRF token not found in HTML");
  }

  return tokenCSFT;
}

function extractRelevantCookies(res) {
  const parsedCookies = parseCookies(res.headers.get('set-cookie'));
  return `_yatri_session=${parsedCookies['_yatri_session']}`;
}

function parseCookies(cookies) {
  return cookies
    ? cookies
      .split(';')
      .map((c) => c.trim().split('=')) // Split each cookie into [name, value]
      .reduce((acc, [name, value]) => {
        acc[name] = value;
        return acc;
      }, {})
    : {};
}

function findAvailableDate(headers, embassyId) {

  return fetch(`${BASE_URL}/schedule/${SCHEDULE_ID}/appointment/days/${embassyId}.json?appointments[expedite]=false`, {
    "headers": Object.assign({}, headers, {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    }),
    "cache": "no-store"
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Fetch data - fail. Status: ${response.status}`);
      }
      return response.json();
    })
    .then(r => handleError(r))
    .then(d => d.length > 0 ? d[0]['date'] : null)
    .catch(error => {
      console.log(`Fetch data - error with message: ${error.message}`);
      return null;
    });
}

function findAvailableTime(headers, date, embassyId) {
  return fetch(`${BASE_URL}/schedule/${SCHEDULE_ID}/appointment/times/${embassyId}.json?date=${date}&appointments[expedite]=false`, {
    "headers": Object.assign({}, headers, {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    }),
    "cache": "no-store"
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Fetch data - fail. Status: ${response.status}`);
      }
      return response.json();
    })
    .then(r => handleError(r))
    .then(d => d['business_times'][0] || d['available_times'][0])
    .catch(error => {
      console.log(`Fetch data - error with message: ${error.message}`);
      return null;
    });
}

async function bookAppointment(sessionHeaders, date, time) {

  const url = `${BASE_URL}/schedule/${SCHEDULE_ID}/appointment`;

  const headers = await fetch(url, {sessionHeaders}).then(response => extractHeaders(response));

  const requestBody = new URLSearchParams({
    'utf8': '✓',
    'authenticity_token': headers['X-CSRF-Token'],
    'confirmed_limit_message': '1',
    'use_consulate_appointment_capacity': 'true',
    'appointments[consulate_appointment][facility_id]': FACILITY_ID,
    'appointments[consulate_appointment][date]': date,
    'appointments[consulate_appointment][time]': time,
    'appointments[asc_appointment][facility_id]': '',
    'appointments[asc_appointment][date]': '',
    'appointments[asc_appointment][time]': ''
  });

  const response = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody,
  });

  return response;
}

function handleError(response) {

  const { error } = response;

  if (error) {
    throw new Error(error);
  }

  return response;
}

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

const args = process.argv.slice(2);
const currentAppointmentDate = args[0]
main(currentAppointmentDate)