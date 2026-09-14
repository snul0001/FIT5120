# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


File structure
src/
├── constants/
│   └── mockData.js          # Mock interests, matches, locations, work preferences
├── utils/
│   ├── helpers.js           # formatLabel & getMatchColor helpers
│   └── pdfExport.js         # jsPDF document generation logic
├── components/
│   ├── Intro.jsx            # Home page
│   ├── PasswordGate.jsx     # Password protected code
│   ├── WorkInProgress.jsx   # Work in progress added.
│   ├── Navbar.jsx           # Top header navigation & theme toggle
│   ├── SetupView.jsx        # Step 1 & Step 2 form inputs
│   ├── ResultsView.jsx      # Match list container & download toolbar
│   ├── MatchCard.jsx        # Expandable card with task impact & intelligence
│   └── Tooltip.jsx          # Dynamic floating tooltip
└── App.jsx                  # Clean top-level state & routing coordinator