# TaskGuard 🛡️

**A desktop task management application with deadline tracking and reminders.**

TaskGuard helps users organize their daily tasks, manage deadlines, and stay productive through a simple desktop interface.

## ✨ Features

* 📝 Create, view, update, and delete tasks.
* ⏳ Track task deadlines and overdue tasks.
* ⏰ Display countdown timers for upcoming deadlines, if enabled.
* 🔔 Receive Windows notifications for reminders, when configured and running.
* 🔍 Search, filter, and sort tasks.
* 🖥️ Run as a desktop application using Electron.
* 📌 Access the app through the system tray, when enabled.

## 🛠️ Built With

* **Frontend:** React, TypeScript, Vite
* **Backend:** Python, FastAPI
* **Desktop:** Electron
* **Testing:** Python and Node.js testing tools

## 📁 Project Structure

```text
TaskGuard/
├── frontend/       # Frontend application
├── backend/        # Python backend and API
├── desktop/        # Electron desktop application
├── data/           # Local application data
├── tests/          # Automated tests
├── .gitignore      # Files excluded from Git
└── README.md       # Project documentation
```

## 🚀 Getting Started

### Prerequisites

Install the following tools:

* Git
* Node.js and npm
* Python 3.12
* Required project dependencies

### Run the Frontend

Open a terminal and run:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed in the terminal.

### Run the Backend

Open a separate terminal from the project root:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Keep the backend running while using the frontend in development mode.

### Run the Desktop Application

Refer to `desktop/README.md` and the scripts in `desktop/package.json` for the correct Electron launch command.

## 🔔 Reminder Information

TaskGuard is designed to help users track deadlines and receive reminders.

Reminder delivery depends on the backend scheduler, desktop application, and Windows notification configuration. Test notifications on your computer before relying on them.

## 🔐 Security

* Never upload API keys, passwords, or private `.env` files.
* Keep virtual environments and generated files out of version control.
* Validate user input on the backend.
* Review the repository before publishing it publicly.

## 🌐 Deployment

The frontend can be deployed to a suitable web hosting platform. The backend, database persistence, and scheduled reminders may require separate deployment configuration.

Windows desktop notifications require an appropriate desktop environment and do not automatically work just because the website is hosted online.

## 🧪 Testing

Run the test commands defined in the project configuration. Automated tests should be supplemented with manual checks for task management, countdown timers, and Windows notifications.

## 📌 Project Status

TaskGuard is under development. Some features may require further testing before they are ready for everyday use.

## 📄 License

No license has been specified yet. Add a license if you intend to permit others to reuse, modify, or distribute this project.
