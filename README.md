# USA VISA Appointment Rescheduling BOT #

This project is designed to help people in Canada to reschedule their USA VISA appointments.
It automates the process of checking for available appointment slots across different embassies and notifies user when suitable slot is found. It also provides the functionality to book a new appointment automatically.

## Installation ##

Before using the tool, you need to install its dependencies. Run the following command in your terminal:

```
npm install
```

## Configuration ##
Before using this application, you need to configure the following variables in **index.js** file:

**USERNAME**: Username from USA VISA appointment website.

**PASSWORD**: Password from USA VISA appointment website.

**SCHEDULE_ID**: Schedule ID for VISA appointment.

**REGION**: Region code for VISA application (e.g., ca for Canada).

**BASE_URL**: Base URL from USA VISA appointment website.

**NOTIFICATION_EMAIL**: Email address for receiving notifications.

You also need to set up **SendGrid API key** for sending email notifications.

Replace **SendGrid API key** with your actual SendGrid API key here: **sgMail.setApiKey()**

## Usage ##

Use the following command to start application:

```
node index.js <currentAppointmentDate>
```

Replace <**currentAppointmentDate**> with the date of your current VISA appointment in the following format: **YYYY-MM-DD**

The tool will continuously check for available appointment slots across different embassies **every 5 minutes**. If application finds slot that meets user criteria, it will send a notification via email and make an attempt to book new appointment automatically.
