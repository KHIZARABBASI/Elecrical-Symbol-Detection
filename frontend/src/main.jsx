// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'

// import 'primeflex/primeflex.css'                        // optional utilities
// import 'primereact/resources/themes/saga-blue/theme.css'// theme (choose another if you like)
// import 'primereact/resources/primereact.min.css'        // core css
// import 'primeicons/primeicons.css'                      // icons
// import './index.css'          

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )


import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'primeflex/primeflex.css'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import './index.css'
import LandingPage from './pages/LandingPage'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>
)
