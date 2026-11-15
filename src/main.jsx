import {createRoot} from 'react-dom/client';import App from './App.jsx';import './styles.css';
import {registerSW} from 'virtual:pwa-register';
createRoot(document.getElementById('root')).render(<App/>);
registerSW({immediate:true});   // offline support: caches the app, the engine and the recognition data
