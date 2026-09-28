import React from 'react';
import { TERMS_AND_CONDITIONS } from '../data/legal';
import { LegalDocumentView } from './LegalDocumentView';

export const TermsConditionsView: React.FC = () => {
  return <LegalDocumentView document={TERMS_AND_CONDITIONS} />;
};
