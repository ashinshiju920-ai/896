import React from 'react';
import { PRIVACY_POLICY } from '../data/legal';
import { LegalDocumentView } from './LegalDocumentView';

export const PrivacyPolicyView: React.FC = () => {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
};
