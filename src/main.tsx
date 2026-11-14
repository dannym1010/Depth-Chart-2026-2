import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { BasketballApp } from './basketball/BasketballApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoScreen } from './filmroom/VideoScreen';
import { SCREEN_HASH } from './filmroom/screenLink';
import { finishDriveSignInPage } from './filmroom/filmSources';
import { getActiveSport, subscribeActiveSport, type ActiveSport } from './sportMode';
import './index.css';

// Back from Google's sign-in page (the app on an iPad's Home Screen): the sign-in kept, the app's address put back.
finishDriveSignInPage();

// The Film Room's video screen (a second window on a TV or monitor) is only the video, not the whole app.
const videoScreen = typeof window !== 'undefined' && window.location.hash === SCREEN_HASH;

const RootApp = () => {
  const [sport, setSport] = useState<ActiveSport>(() => getActiveSport());
  useEffect(() => subscribeActiveSport(setSport), []);
  return sport === 'basketball' ? <BasketballApp /> : <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {videoScreen ? <VideoScreen /> : <RootApp />}
    </ErrorBoundary>
  </StrictMode>,
);
