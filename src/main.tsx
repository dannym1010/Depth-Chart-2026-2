import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoScreen } from './filmroom/VideoScreen';
import { SCREEN_HASH } from './filmroom/screenLink';
import './index.css';

// The Film Room's video screen (a second window on a TV or monitor) is only the video, not the whole app.
const videoScreen = typeof window !== 'undefined' && window.location.hash === SCREEN_HASH;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {videoScreen ? <VideoScreen /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
