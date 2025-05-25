/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {CapsSubject} from '@/lib/types'; // Import CapsSubject
import {createContext} from 'react'; 

export interface Data {
  capsStructure: CapsSubject[]; 
  isLoadingCaps: boolean; 
}

export const DataContext = createContext<Data | null>(null);