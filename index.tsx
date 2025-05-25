/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import App from '@/App';
import LandingPage from '@/LandingPage'; // Import the new LandingPage component
import {DataContext} from '@/context';
import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom/client';
import {CapsSubject} from '@/lib/types';

function DataProvider({children}) {
  const [capsStructure, setCapsStructure] = useState<CapsSubject[]>([]);
  const [isLoadingCaps, setIsLoadingCaps] = useState(true);

  useEffect(() => {
    async function fetchCapsData() {
      setIsLoadingCaps(true);
      try {
        const response = await fetch('public/data/caps_structure.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for url ${response.url}`);
        }
        const data = await response.json();
        setCapsStructure(data);
      } catch (error) {
        console.error("Could not fetch CAPS structure:", error);
        setCapsStructure([]); 
      } finally {
        setIsLoadingCaps(false);
      }
    }
    fetchCapsData();
  }, []);


  const value = {
    capsStructure,
    isLoadingCaps,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function Main() {
  const [showLandingPage, setShowLandingPage] = useState(true);

  const handleStartApp = () => {
    setShowLandingPage(false);
  };

  const handleGoBackToLanding = () => {
    setShowLandingPage(true);
  };

  return (
    <DataProvider>
      {showLandingPage ? (
        <LandingPage onStartApp={handleStartApp} />
      ) : (
        <App onGoBackToLanding={handleGoBackToLanding} />
      )}
    </DataProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Main />);