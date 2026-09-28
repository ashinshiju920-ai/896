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
