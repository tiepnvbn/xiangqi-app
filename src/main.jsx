import {createRoot} from 'react-dom/client';import Hub from './Hub.jsx';import './styles.css';
import {registerSW} from 'virtual:pwa-register';
createRoot(document.getElementById('root')).render(<Hub/>);
registerSW({immediate:true});   // offline support: caches the app, the engines and the recognition data
