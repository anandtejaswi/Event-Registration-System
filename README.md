# EVENTRACK - Event Management System

## Overview

EVENTRACK is a full-stack web application designed to simplify event planning and participation. It serves as a centralized platform where organizers can manage events, schedules, and sponsors, while users can discover events, register as audience members or volunteers, and manage their profiles.

This project implements a **3-Tier Architecture** using a Node.js backend, a MySQL database, and a responsive HTML/JavaScript frontend.

## Features

### 🎭 User Roles

  * **Organizer:**
      * Create and manage events.
      * Manage event schedules (add/edit items).
      * Manage sponsors (add/edit details).
      * View audience lists and manage volunteer roles.
  * **Audience:**
      * Browse upcoming events.
      * Register for events (with duplicate check).
      * View digital tickets for registered events.
      * View personal event history.
  * **Volunteer:**
      * Register for events indicating interest.
      * Roles are assigned/managed by the event organizer.

### 🛠 Core Functionality

  * **Authentication:** Secure user registration and login system.
  * **Event Dashboard:** Dynamic display of upcoming events with registration counts and pricing (INR).
  * **Ticket System:** Auto-generated digital tickets with user and event details.
  * **Profile Management:** Users can update personal details (Phone, Address, etc.) and change passwords.
  * **Responsive UI:** Built with Tailwind CSS for mobile and desktop compatibility.

## Tech Stack

  * **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (via CDN).
  * **Backend:** Node.js, Express.js.
  * **Database:** MySQL.
  * **Connectivity:** REST API, CORS, MySQL2 driver.

## Prerequisites

Before running this project, ensure you have the following installed:

1.  **Node.js** (v14 or higher) - [Download Here](https://nodejs.org/)
2.  **MySQL Server** (v8.0 or higher) - [Download Here](https://dev.mysql.com/downloads/installer/)

## Installation & Setup Guide

### Step 1: Database Setup

1.  Open your MySQL client (MySQL Workbench, Command Line, etc.).
2.  Create a new database named `eventrack`.
3.  Open the `database_setup.sql` file provided in this project.
4.  Run the script to create all necessary tables (`User`, `Events`, `Registrations`, `Schedule`, `Sponsor`, etc.).

### Step 2: Project Setup

1.  Download or clone this project folder.
2.  Open a terminal (Command Prompt/PowerShell) in the root folder (`event-manager`).
3.  Install the required backend dependencies:
    ```bash
    npm install
    ```

### Step 3: Configuration

1.  Open the `server.js` file.
2.  Locate the `dbConfig` object near the top of the file.
3.  Update the `user` and `password` fields to match your local MySQL credentials:

    ```javascript
    const dbConfig = {
        host: 'localhost',
        user: 'root',       // Change to your MySQL username
        password: 'YOUR_PASSWORD', // Change to your MySQL password
        database: 'eventrack'
    };
    ```

### Step 4: Running the Application

1.  In your terminal, start the backend server:
    ```bash
    node server.js
    ```
2.  You should see the message: `Server is running on http://localhost:3000`
3.  Open your web browser and navigate to:
    ```
    http://localhost:3000
    ```
## API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Fetch all public events |
| `POST` | `/api/register` | Register a new user |
| `POST` | `/api/login` | Authenticate user |
| `POST` | `/api/event/ticket` | Get ticket details for a registered user |
| `POST` | `/api/user/profile` | Get user profile details |
| `PUT` | `/api/user/profile` | Update user profile |
| `POST` | `/api/schedule` | Add a schedule item (Organizer only) |
| `PUT` | `/api/schedule/:id` | Update a schedule item (Organizer only) |

*(Refer to `server.js` for the complete list of endpoints)*

## Troubleshooting

  * **"Connection Refused" Error:** Check if your MySQL server is running and if the password in `server.js` is correct.
  * **Styling looks broken:** Ensure you have an active internet connection. The project loads Tailwind CSS from the web.
  * **Login not working:** Check the browser console (F12) for error messages. Ensure the backend server is running.