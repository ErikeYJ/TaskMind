import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import BallApp from './BallApp'
import './styles.css'

const isBall = window.location.hash.startsWith('#/ball')
if (isBall) {
  document.documentElement.classList.add('ball-window')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isBall ? <BallApp /> : <App />}</React.StrictMode>
)
