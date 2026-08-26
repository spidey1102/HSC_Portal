# HSC Portal

A modern all-in-one portal designed to help NSW HSC students manage study resources, assessments, notes, timetables, and exam preparation in one place.

---

## Features

- 📚 Subject resource management
- 📝 Assessment tracking
- 📅 Study planner and timetable support
- 📊 Progress monitoring
- 🔍 Easy navigation for HSC materials
- 💻 Clean and responsive user interface
- ⚡ Fast and lightweight performance

---

## Tech Stack

This project includes:

- Frontend: HTML, CSS, JavaScript
- Backend: Vite.js 
- Database: Firebase
- Hosting: Vercel

---

## Installation

Clone the repository:

```bash
git clone https://github.com/spidey1102/HSC_Portal.git
```

Navigate into the project folder:

```bash
cd HSC_Portal
```

Install dependencies (if applicable):

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

or

```bash
npm start
```

## Windows Desktop App

HSCPortal can also be distributed as a native Windows application. The Electron shell loads the live portal at [www.hscportal.app](https://www.hscportal.app), so Firebase sign-in, cloud sync, AI assistance, past-paper data, and future website updates continue to work without putting API credentials in the executable.

Create the Windows installer and standalone executable from a Windows development machine:

```bash
npm ci
npm run desktop:dist
```

The command writes two 64-bit `.exe` files into `release/`:

| File | Purpose |
| --- | --- |
| `HSC Portal-<version>-x64-installer.exe` | Guided installer with Start Menu and desktop shortcuts. |
| `HSC Portal-<version>-x64-portable.exe` | Standalone executable that runs without installation. |

For desktop development, run `npm run dev` in one terminal, then set `ELECTRON_START_URL=http://localhost:3000` and run `npm run desktop:start` in another. Production builds open `https://www.hscportal.app` by default.

## macOS and Linux Desktop Packages

The same Electron shell can be packaged for macOS and Linux:

| Platform | Build command | Output |
| --- | --- | --- |
| Linux (x64) | `npm run desktop:linux` | `release/HSC Portal-<version>-x86_64.AppImage` |
| macOS Intel | `npm run desktop:mac` | `release/HSC Portal-<version>-x64.dmg` |
| macOS Apple Silicon | `npm run desktop:mac` | `release/HSC Portal-<version>-arm64.dmg` |

Build the DMGs on a macOS machine or macOS CI runner because Apple’s disk-image tooling is required. The packages are not code signed or notarized; until Apple signing credentials are configured, macOS may require students to use **Control-click → Open** on the first launch.

---

## Usage

1. Just Run

---

## Folder Structure

```plaintext
HSC_Portal/
│
├── public/            # Static assets
├── src/               # Main source code
│   ├── components/    # Reusable UI components
│   ├── pages/         # Application pages
│   ├── styles/        # CSS / styling
│   └── utils/         # Helper functions
│
├── package.json
├── README.md
└── LICENSE
```

---

## Future Improvements

- 🔔 Notification reminders for assessments
- 🤝 Collaborative study groups
- 📈 Advanced analytics dashboard
- 📱 Mobile app support
- ☁️ Cloud sync and backups

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to your branch

```bash
git push origin feature-name
```

5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Author

Created by [spidey1102](https://github.com/spidey1102)

Contributions and partial rewrite from [xslvrrr](https://github.com/xslvrrr)

---

## Repositories

https://github.com/spidey1102/HSC_Portal (original)

https://github.com/xslvrrr/HSC_Portal (contribution fork)
