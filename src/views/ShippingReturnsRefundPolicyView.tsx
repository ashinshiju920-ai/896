import React from 'react';
import { SHIPPING_RETURNS_REFUND_POLICY } from '../data/legal';
import { LegalDocumentView } from './LegalDocumentView';

export const ShippingReturnsRefundPolicyView: React.FC = () => {
  return <LegalDocumentView document={SHIPPING_RETURNS_REFUND_POLICY} />;
};
