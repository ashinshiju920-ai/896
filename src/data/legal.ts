export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: '28 September 2026',
  intro: [
    'Aylem Learning PVT respects your privacy and is committed to protecting the personal information you provide when using our website, purchasing our educational materials, creating an account, or contacting us.',
    'This Privacy Policy explains what information we collect, how we use it, how we protect it, and your rights and choices regarding your information.',
  ],
  sections: [
    {
      title: '1. Company Details',
      paragraphs: [
        'Aylem Learning PVT',
        'Address: Lanark Rd, Carluke ML8 51L, United Kingdom',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Grievance / Privacy Contact: Sidharth Babu',
        'Grievance Email: aylembookstore@gmail.com',
      ],
    },
    {
      title: '2. Information We Collect',
      paragraphs: ['Depending on how you use our website, we may collect customer, order, payment, technical, and website analytics information.'],
      items: [
        'Customer information such as full name, email address, mobile phone number, and account/authentication information.',
        'Order information such as products purchased, selected add-ons, quantity, order ID, payment/order status, amount paid, coupon or promotional information, and purchase date/time.',
        'Payment information needed for processing through Cashfree Payments. We do not intentionally store complete card numbers, CVV, UPI PIN, or similar sensitive payment credentials on our own systems.',
        'Technical information necessary to operate and secure the website, including browser, device, IP/network, and basic diagnostic information where necessary.',
        'Limited first-party analytics such as product views, add-to-cart actions, checkout starts, payment initiation, and completed purchases.',
      ],
    },
    {
      title: '3. How We Use Information',
      items: [
        'Process and fulfill purchases.',
        'Provide access to purchased digital materials.',
        'Create and manage customer accounts.',
        'Verify payments.',
        'Maintain order and entitlement records.',
        'Provide customer support.',
        'Prevent fraud, abuse, and unauthorized access.',
        'Manage coupons and promotions.',
        'Improve our products and website.',
        'Maintain security and reliability.',
        'Meet legal and regulatory obligations.',
      ],
    },
    {
      title: '4. Digital Products and Downloads',
      paragraphs: [
        'Aylem Learning may sell downloadable digital products, including educational PDF materials.',
        'Following successful payment verification, purchased materials may be associated with your order and/or customer account.',
        'Access to protected digital materials may require authentication and authorization. Temporary download links or security tokens may expire even though your underlying purchase entitlement remains active. A new authorized link may be generated when necessary.',
      ],
    },
    {
      title: '5. Payment Processing',
      paragraphs: [
        'Payments are processed through Cashfree Payments. Information required to process your payment may be transmitted to or processed by the payment provider.',
        "Cashfree's own terms and privacy practices may apply to information processed directly by Cashfree.",
        'Aylem Learning uses verified payment information to determine whether digital products can be released.',
      ],
    },
    {
      title: '6. Third-Party Service Providers',
      paragraphs: ['We may use third-party technology providers required to operate our website and services, including Cloudflare, Cloudinary, and Cashfree Payments. These providers may process information as necessary to provide their services.'],
    },
    {
      title: '7. Cookies',
      paragraphs: ['We may use cookies and similar technologies for authentication, customer sessions, cart functionality, security, preferences, and operational analytics. Disabling necessary cookies may affect login, cart functionality, checkout, or access to purchased materials.'],
    },
    {
      title: '8. Customer Accounts',
      paragraphs: [
        'Where accounts are provided, account information is used to allow customers to sign in, access eligible purchased materials, and manage their account.',
        'Passwords are not intentionally stored in plain text. You are responsible for keeping your login credentials confidential.',
      ],
    },
    {
      title: '9. Data Security',
      paragraphs: ['We use reasonable technical and organizational safeguards to protect personal information. No internet service can guarantee absolute security.'],
      items: [
        'HTTPS.',
        'Password hashing.',
        'Secure authentication cookies.',
        'Access controls.',
        'Rate limiting.',
        'Parameterized database queries.',
        'Payment webhook verification.',
        'Cryptographically signed download authorization.',
        'Server-side authorization.',
      ],
    },
    {
      title: '10. Data Retention',
      paragraphs: [
        'We retain personal information for as long as reasonably necessary for customer accounts, order processing, digital entitlements, security, customer support, accounting/legal requirements, fraud prevention, and dispute resolution.',
        'Some records may need to be retained after account closure where legally required or reasonably necessary for legitimate business purposes.',
      ],
    },
    {
      title: '11. Your Privacy Requests',
      paragraphs: [
        'You may contact us regarding applicable requests concerning your personal information, including requests to access, correct, update, or delete information where legally applicable.',
        'Contact: Sidharth Babu, aylembookstore@gmail.com, +91 6282377918.',
        'We may need to verify your identity before completing certain requests.',
      ],
    },
    {
      title: "12. Children's Privacy",
      paragraphs: [
        "Our website is not intentionally designed to collect children's personal information in circumstances where such collection is prohibited by applicable law.",
        'If you believe personal information has been provided improperly, please contact us.',
      ],
    },
    {
      title: '13. Third-Party Links',
      paragraphs: ['Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of third parties. Please review their own privacy policies.'],
    },
    {
      title: '14. Changes to This Privacy Policy',
      paragraphs: ['We may update this Privacy Policy from time to time to reflect changes to our services, technology, or legal requirements. The latest version will always be published on this page with an updated date.'],
    },
    {
      title: '15. Contact',
      paragraphs: [
        'Aylem Learning PVT',
        'Lanark Rd, Carluke ML8 51L, United Kingdom',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Privacy / Grievance Contact: Sidharth Babu',
      ],
    },
  ],
};

export const TERMS_AND_CONDITIONS: LegalDocument = {
  title: 'Terms and Conditions',
  lastUpdated: '28 September 2026',
  intro: [
    'These Terms and Conditions govern your use of the Aylem Learning website and the purchase and use of products offered through it.',
    'By using our website or placing an order, you agree to these Terms.',
  ],
  sections: [
    {
      title: '1. Company Details',
      paragraphs: [
        'Aylem Learning PVT',
        'Address: Lanark Rd, Carluke ML8 51L, United Kingdom',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Grievance Contact: Sidharth Babu',
        'Grievance Email: aylembookstore@gmail.com',
      ],
    },
    {
      title: '2. Our Products',
      paragraphs: ['Aylem Learning provides educational and exam-preparation materials, including digital study materials and, where offered, physical educational products. Products may relate to IELTS, OET, PTE, German-language examinations, or other educational subjects.'],
    },
    {
      title: '3. Product Information',
      paragraphs: ['We make reasonable efforts to ensure that product descriptions, prices, images, formats, and availability are accurate. Digital products may be updated or replaced from time to time.'],
    },
    {
      title: '4. Digital Products',
      paragraphs: ['Digital products are normally made available after successful payment verification. Access may be provided through a customer account, secure download link, My Materials area, or another method displayed at the time of purchase.'],
    },
    {
      title: '5. Lifetime Access',
      paragraphs: [
        "Where a product is specifically advertised as providing lifetime access, this refers to continued access to the purchased material through Aylem Learning's service for the applicable lifetime of the product/service offering, subject to these Terms and continued operation of the service.",
        "Where appropriate, we may replace or update a digital file while maintaining the customer's underlying purchase entitlement.",
        'Lifetime access does not give a customer the right to redistribute, resell, publicly share, or commercially exploit the material.',
      ],
    },
    {
      title: '6. Prices and Payment',
      paragraphs: ['Prices are displayed in the currency stated on the relevant product or checkout page. The final payable amount is calculated and verified by our systems. Payments are processed through Cashfree Payments.'],
      items: ['Products selected.', 'Quantities.', 'Add-ons.', 'Valid coupons.', 'Promotions.', 'Delivery charges for physical products.', 'Applicable taxes or other legally required charges.'],
    },
    {
      title: '7. Coupons and Promotions',
      paragraphs: ['Promotional codes, discounts, bundles, and special offers may have specific conditions. Entering a coupon code does not by itself guarantee that the discount will apply. The applicable promotion is determined according to the promotional rules in effect for the transaction.'],
      items: ['Expiry dates.', 'Product restrictions.', 'Minimum order values.', 'Usage limits.', 'Customer limits.', 'Maximum discount limits.', 'Other eligibility requirements.'],
    },
    {
      title: '8. Order Confirmation',
      paragraphs: ['Opening the payment page or attempting payment does not necessarily mean that payment has been successfully completed. Digital fulfillment occurs only after payment has been successfully verified. Where payment verification is pending, access may remain temporarily unavailable.'],
    },
    {
      title: '9. Refunds and Cancellations',
      paragraphs: [
        'Because digital products may become immediately accessible after payment, customers should review the product description and purchase details carefully before completing an order.',
        'Refund requests should be submitted to aylembookstore@gmail.com with your order ID and relevant transaction information.',
        'For physical products, applicable delivery, return, replacement, cancellation, or refund conditions may be provided with the relevant product. Nothing in these Terms is intended to remove rights that cannot legally be excluded.',
      ],
      items: ['Duplicate charges.', 'Successful payment where the purchased digital material cannot technically be delivered.', 'A material technical failure preventing access to a purchased product.', 'A transaction processed incorrectly.', 'Other circumstances where a refund is required by applicable law or approved by Aylem Learning.'],
    },
    {
      title: '10. Digital Material Usage',
      paragraphs: ['Purchased digital materials are provided for personal educational use unless expressly stated otherwise. Unauthorized distribution may result in suspension or termination of access and may lead to further action where appropriate.'],
      items: ['You must not resell materials, share purchased PDFs publicly or privately, upload materials to websites or file-sharing platforms, distribute materials through messaging/social groups, repackage materials for commercial use, claim materials as your own, circumvent access controls, share secure download links, or attempt to bypass technical protections.'],
    },
    {
      title: '11. Intellectual Property',
      paragraphs: ['Unless otherwise stated, Aylem Learning and/or its licensors retain rights in the website and its original content, including logos, branding, website content, product descriptions, book covers, digital study materials, text, graphics, photographs, software, and other original content. Purchasing a digital product does not transfer ownership of the underlying intellectual property.'],
    },
    {
      title: '12. Customer Accounts',
      paragraphs: ['Where an account is created, you are responsible for maintaining the confidentiality of your account credentials. You should notify us promptly if you believe your account has been compromised. We may restrict or suspend accounts involved in fraud, abuse, unauthorized distribution, security violations, or other serious breaches of these Terms.'],
    },
    {
      title: '13. Secure Downloads',
      paragraphs: ['Aylem Learning may use temporary signed download links and account-based authorization to protect digital materials. Download links may expire for security reasons. An expired download link does not necessarily mean that the underlying entitlement has expired.'],
    },
    {
      title: '14. Product and Service Availability',
      paragraphs: ['We may update, modify, suspend, or discontinue products or website features. Where reasonably possible, previously purchased digital materials may remain accessible according to the applicable purchase entitlement.'],
    },
    {
      title: '15. Educational Disclaimer',
      paragraphs: ['Aylem Learning provides educational and exam-preparation materials. Our materials are intended as preparation resources and do not guarantee a particular IELTS band, OET grade, PTE score, examination result, admission, employment, visa approval, professional registration, or any other specific outcome. Examination bodies and authorities determine their own examination content, scoring, policies, schedules, and requirements.'],
    },
    {
      title: '16. Website Availability',
      paragraphs: ['We aim to maintain reliable website and digital-access services but cannot guarantee uninterrupted availability. Temporary interruptions may occur because of maintenance, payment-provider problems, infrastructure outages, network failures, security measures, third-party service failures, or events beyond our reasonable control.'],
    },
    {
      title: '17. Prohibited Activities',
      items: ['Commit fraud.', 'Attempt unauthorized access.', 'Circumvent security controls.', 'Manipulate payment or pricing systems.', 'Abuse promotional offers.', 'Distribute protected materials without authorization.', 'Introduce malicious software.', 'Interfere with website operations.', 'Infringe intellectual-property rights.', 'Violate applicable law.'],
    },
    {
      title: '18. Third-Party Services',
      paragraphs: ['Our website may use services such as Cloudflare, Cloudinary, Cashfree Payments, WhatsApp, and other third-party providers. Your use of third-party services may also be governed by their own terms and policies.'],
    },
    {
      title: '19. Privacy',
      paragraphs: ['Your use of Aylem Learning is also subject to our Privacy Policy.'],
    },
    {
      title: '20. Errors and Corrections',
      paragraphs: ['We may correct accidental typographical, pricing, product-description, or availability errors. Where an error materially affects an order, we may take reasonable steps to address the issue subject to applicable law.'],
    },
    {
      title: '21. Limitation of Liability',
      paragraphs: ['To the maximum extent permitted by applicable law, Aylem Learning will not be responsible for indirect, incidental, special, or consequential losses arising from use of the website or digital materials. Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited.'],
    },
    {
      title: '22. Termination or Suspension',
      paragraphs: ['Access may be restricted or suspended where reasonably necessary because of fraud, unauthorized redistribution, security abuse, account compromise, material breach of these Terms, or legal/regulatory requirements.'],
    },
    {
      title: '23. Changes to These Terms',
      paragraphs: ['We may update these Terms from time to time. The latest version will be published on this page with a revised date.'],
    },
    {
      title: '24. Governing Law',
      paragraphs: ['These Terms are subject to the laws applicable to Aylem Learning PVT and the mandatory consumer-protection laws applicable to the customer and transaction. Nothing in these Terms is intended to remove statutory rights that cannot legally be excluded.'],
    },
    {
      title: '25. Complaints and Grievances',
      paragraphs: [
        'For customer support, complaints, privacy issues, or grievances:',
        'Aylem Learning PVT, Lanark Rd, Carluke ML8 51L, United Kingdom',
        'Sidharth Babu',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Please include your order ID and sufficient details for us to investigate your issue.',
      ],
    },
  ],
};

export const SHIPPING_RETURNS_REFUND_POLICY: LegalDocument = {
  title: 'Shipping, Returns & Refund Policy',
  lastUpdated: '28 September 2026',
  intro: [
    'This Shipping, Returns & Refund Policy applies to purchases made through Aylem Learning\'s website, including digital educational products, downloadable PDF materials, and physical educational books or study materials where available.',
    'This policy should be read together with our Terms & Conditions and Privacy Policy. Nothing in this policy is intended to restrict any mandatory consumer rights that apply under applicable law.',
  ],
  sections: [
    {
      title: 'Company Details',
      paragraphs: [
        'Aylem Learning PVT',
        'Lanark Rd, Carluke ML8 51L, United Kingdom',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Grievance Contact: Sidharth Babu',
        'Grievance Email: aylembookstore@gmail.com',
      ],
    },
    {
      title: '1. Scope',
      paragraphs: ['This policy applies to digital educational products, downloadable PDF materials, and physical educational books or study materials purchased through Aylem Learning where available.'],
    },
    {
      title: 'Part A - Digital Products',
      paragraphs: ['Digital products are delivered electronically after successful payment verification. Payment initiation or return from the payment gateway does not itself constitute confirmed payment. Digital access is activated after the relevant payment has been successfully verified.'],
      items: ['Access may be provided through your Aylem Learning account.', 'Access may be provided through My Materials, a secure download link, or another digital-access method displayed during or after checkout.'],
    },
    {
      title: '2. Digital Product Returns - 24 Hours',
      paragraphs: [
        'Aylem Learning provides a 24-hour return/refund window for eligible digital purchases, subject to the conditions below and any mandatory rights applicable to the customer.',
        'A refund request should normally be submitted within 24 hours of successful payment to aylembookstore@gmail.com.',
      ],
      items: ['Include your order ID.', 'Include the customer name and email used for the purchase.', 'Include the reason for the request.', 'Include relevant evidence where applicable.'],
    },
    {
      title: '3. Digital Product Refund Conditions',
      paragraphs: [
        'Because digital materials may be made available immediately after payment, refunds are subject to eligibility review.',
        'Where a customer has already downloaded, accessed, copied, or used a digital product, Aylem Learning may restrict voluntary refunds to the extent permitted by applicable law and the terms accepted at purchase.',
        'Where UK digital-content cancellation rules apply, the customer may lose the statutory cancellation right once digital supply begins where the customer has expressly agreed to immediate supply and acknowledged the loss of that cancellation right. This does not affect statutory rights relating to faulty or non-conforming digital content.',
      ],
      items: [
        'A refund may be considered where the wrong digital product was supplied due to an error attributable to Aylem Learning.',
        'A refund may be considered where the purchased material is technically inaccessible because of a problem on our side.',
        'A refund may be considered where a duplicate charge occurred.',
        'A refund may be considered where payment was successfully completed but the purchased material was not delivered.',
        'A refund may be considered where the digital product is materially different from what was represented.',
        'A refund may be considered where required by applicable law.',
      ],
    },
    {
      title: '4. Non-Refundable Situations for Digital Products',
      paragraphs: ['To the extent permitted by applicable law, a voluntary refund may not be available in the following situations. Statutory consumer rights remain unaffected.'],
      items: [
        'The customer simply changes their mind after downloading or accessing the material.',
        'The customer purchased the wrong examination/category by mistake.',
        'The customer has independently shared or redistributed the material.',
        'The customer has violated the Terms & Conditions.',
        'The customer has already received the purchased material and the product is functioning as described.',
      ],
    },
    {
      title: 'Part B - Physical Products',
      paragraphs: [
        'Physical products are shipped to the address provided by the customer during checkout. Customers are responsible for providing a complete and accurate shipping address and contact information.',
        'Where a shipment is returned to Aylem Learning because of incorrect customer information or repeated failed delivery attempts, additional shipping costs may apply to a subsequent delivery where legally permitted.',
      ],
      items: [
        'Aylem Learning is not responsible for delays caused by incorrect or incomplete addresses.',
        'Aylem Learning is not responsible for delays caused by customer unavailability or failure to receive delivery.',
        'Aylem Learning is not responsible for delays caused by courier restrictions, natural disasters, government restrictions, or events outside our reasonable control.',
      ],
    },
    {
      title: '5. Delivery Times',
      paragraphs: [
        'Estimated delivery information will be displayed where available during the relevant purchase.',
        'Delivery estimates are not guarantees unless expressly stated otherwise. Third-party courier delays may occur after dispatch.',
        'Where a legally applicable delivery deadline applies, nothing in this policy excludes that right.',
      ],
    },
    {
      title: '6. Physical Product Returns - 7 Days',
      paragraphs: [
        'Aylem Learning offers a 7-day return window for eligible physical products, beginning from the date the product is delivered.',
        'A return request should be submitted to aylembookstore@gmail.com within the applicable return period.',
        'Where mandatory consumer law provides a longer cancellation or return right, that statutory right will apply. For example, UK distance-selling rules generally provide a 14-day cancellation period for eligible goods.',
      ],
    },
    {
      title: '7. Eligible Physical Returns',
      paragraphs: ['For a damaged or incorrect item, customers should contact us as soon as reasonably possible and provide photographs or other evidence where requested.'],
      items: ['Damaged on arrival.', 'Defective.', 'Incorrectly supplied.', 'Significantly different from the product ordered.', 'Otherwise eligible under the applicable return policy or consumer law.'],
    },
    {
      title: '8. Condition for Voluntary Returns',
      paragraphs: [
        'For voluntary returns, the product should generally be unused, in its original condition, properly packaged, and accompanied by relevant order information.',
        'Where the law permits a consumer to handle a product in order to determine its nature, characteristics, and functioning, we will respect those rights. Excessive handling may have consequences in certain circumstances.',
      ],
    },
    {
      title: '9. Products Not Eligible for Voluntary Return',
      paragraphs: ['To the extent permitted by applicable law, a voluntary return may be refused in the following situations. This does not remove mandatory rights relating to faulty, defective, or misdescribed goods.'],
      items: ['The product has been materially damaged through customer misuse.', 'The product has been intentionally altered.', 'The product is returned without required components.', 'The product has been excessively used beyond what is reasonably necessary to inspect it.', 'The product cannot be returned because of a statutory exception.'],
    },
    {
      title: '10. Wrong or Damaged Product',
      paragraphs: ['If you receive the wrong book, a damaged book, or a materially defective product, contact us at aylembookstore@gmail.com as soon as reasonably possible. Where appropriate, we may provide replacement, repair where applicable, refund, or another legally appropriate remedy.'],
    },
    {
      title: 'Part C - Refunds',
      paragraphs: [
        'A return request does not automatically mean that a refund has been approved. We may review order information, payment information, product eligibility, return condition, delivery status, and relevant evidence.',
        'Approved refunds will normally be issued using the same payment method used for the original transaction, unless otherwise agreed or required by applicable law.',
      ],
    },
    {
      title: '11. Refund Processing Time',
      paragraphs: [
        'Once a refund has been approved, Aylem Learning will normally initiate the refund within 1-4 business days.',
        'After the refund has been initiated, the time taken for the amount to appear in the customer\'s bank account, card account, UPI account, or other payment method may depend on the payment provider, bank, card network, or other financial institution.',
        'Where applicable law requires an earlier refund, the statutory deadline will take precedence.',
      ],
    },
    {
      title: '12. Shipping Charges and Refunds',
      paragraphs: [
        'Where a physical order qualifies for cancellation/refund under applicable law, the treatment of original delivery charges will follow the applicable legal requirements.',
        'Where a customer selected an upgraded delivery service, any refund of delivery charges may be limited to the applicable standard delivery cost where permitted by law.',
        'Return shipping costs may be the customer\'s responsibility for voluntary returns where legally permitted and where the applicable return information was provided before purchase.',
        'For incorrect, defective, or damaged products attributable to Aylem Learning, we may arrange or reimburse reasonable return shipping where appropriate.',
      ],
    },
    {
      title: '13. Failed Digital Delivery and Duplicate Payments',
      paragraphs: [
        'If payment is successfully completed but Aylem Learning is unable to provide the purchased digital material because of a technical problem attributable to our service, contact aylembookstore@gmail.com. We will investigate and, where appropriate, provide access, replacement material, or a refund in accordance with applicable law.',
        'If you believe you have been charged more than once for the same order, contact us immediately with your order ID, transaction details, and payment reference where available. After verification, an eligible duplicate payment may be refunded.',
      ],
    },
    {
      title: '14. Payment Reversals and Chargebacks',
      paragraphs: [
        'Customers should contact Aylem Learning first where there is a payment or fulfillment dispute so that we can investigate and resolve the issue where possible.',
        'Nothing in this section limits any rights a customer has through their payment provider, bank, card issuer, or applicable law.',
      ],
    },
    {
      title: '15. Fraudulent or Abusive Refund Requests',
      paragraphs: ['Aylem Learning reserves the right, to the extent permitted by law, to investigate suspected fraud or abuse. Where fraud or abuse is reasonably suspected, access to the relevant account or services may be restricted while the matter is investigated. This provision does not remove legitimate consumer rights.'],
      items: ['Fraudulent transactions.', 'Repeated abusive refund claims.', 'Unauthorized payment disputes.', 'False damage/return claims.', 'Account abuse.', 'Unauthorized distribution of digital products.'],
    },
    {
      title: '16. Order Cancellation Before Dispatch',
      paragraphs: [
        'For physical products, customers may contact us as soon as possible to request cancellation before dispatch. Once an order has been dispatched, the applicable return/cancellation process may apply instead.',
        'For digital products, cancellation rights are subject to the rules applicable to digital content and whether digital supply has begun.',
      ],
    },
    {
      title: '17. Customer Responsibility',
      items: ['Enter accurate contact details.', 'Provide an accurate delivery address.', 'Review the product description before purchase.', 'Check the selected examination/product.', 'Keep order information.', 'Protect account credentials.', 'Do not share purchased digital materials.'],
    },
    {
      title: '18. No Waiver of Statutory Rights',
      paragraphs: ['Nothing in this policy is intended to exclude, restrict, or replace rights that consumers cannot legally waive. Where applicable consumer law gives a customer a greater right than the voluntary policy described here, the applicable law will prevail.'],
    },
    {
      title: '19. How to Request a Return or Refund',
      paragraphs: [
        'Contact Aylem Learning PVT, Lanark Rd, Carluke ML8 51L, United Kingdom.',
        'Email: aylembookstore@gmail.com',
        'Phone / WhatsApp: +91 6282377918',
        'Grievance Contact: Sidharth Babu',
        'Grievance Email: aylembookstore@gmail.com',
        'For faster processing, include: order ID, registered email, product name, and reason for request.',
      ],
    },
    {
      title: '20. Changes to This Policy',
      paragraphs: ['Aylem Learning may update this policy when its products, services, payment systems, shipping arrangements, or legal obligations change. The latest version will be published on this page with the applicable Last Updated date.'],
    },
  ],
};
