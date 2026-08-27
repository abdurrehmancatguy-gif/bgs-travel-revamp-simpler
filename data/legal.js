import {
  WHATSAPP_DISPLAY, CONTACT_EMAIL, LOCATION, buildWhatsAppUrl,
} from "../utils/whatsapp.js?v=208";

/**
 * Contact details and the legal notices, as data rather than markup, so the
 * same content feeds every surface that shows it and can later be pointed at
 * the store the way the rest of the catalogue is.
 *
 * The notices below are BGS's own supplied text, reproduced as given. A `body`
 * entry is either a paragraph string or { list: [...] } for a bulleted run —
 * the two shapes the source document uses. Nothing here renders a rule or a
 * divider: the source marked its parts with ASCII separators, which are a
 * plain-text device and have no business in a rendered panel.
 */

export const CONTACT_CHANNELS = [
  {
    key: "whatsapp",
    icon: "whatsapp",
    label: "WhatsApp",
    value: WHATSAPP_DISPLAY,
    // Built here rather than concatenated, so this link carries the same
    // opening message as every other WhatsApp entry point on the site.
    href: buildWhatsAppUrl("Hi BGS Travel & Tourism, I'd like help planning a trip."),
    note: "Fastest way to reach the team.",
  },
  {
    key: "email",
    icon: "mail",
    label: "Email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    note: "For itineraries, quotes and documents.",
  },
  {
    key: "office",
    icon: "pin",
    label: "Office",
    value: LOCATION,
    href: "",
    note: "",
  },
];

/** Shown at the head of both notices, since the source applies it to both. */
const ACCEPTANCE =
  "By accessing our website, making a booking, or using our services, you " +
  "confirm that you have read, understood, and agreed to both our Privacy " +
  "Policy and our Terms of Service.";

export const LEGAL_DOCS = {
  contact: {
    title: "Contact BGS Travel & Tourism",
    kind: "contact",
    intro:
      "One team handles the whole journey — planning, booking and everything in between.",
  },

  privacy: {
    title: "Privacy Policy",
    intro: ACCEPTANCE,
    sections: [
      {
        heading: "1. Information we collect",
        body: [
          "We may collect the following types of information:",
          { list: [
            "Personal identification information: full name, date of birth, nationality, passport or visa details, contact information, postal address, email address, and phone number.",
            "Travel-related information: travel dates, destinations, accommodation preferences, dietary requirements, medical needs relevant to travel, frequent flyer numbers, and emergency contact details.",
            "Payment information: billing address and payment card details. Full payment card numbers are processed by our secure third-party payment providers and are not stored on our own servers.",
            "Technical information: IP address, browser type, device type, operating system, pages visited, time spent on pages, and referral sources.",
            "Communication information: messages, feedback, reviews, and any other information you choose to share with us.",
          ] },
        ],
      },
      {
        heading: "2. How we use your information",
        body: [
          "We use your information to:",
          { list: [
            "Provide, manage, and deliver travel and tourism services.",
            "Process bookings, payments, and refunds.",
            "Communicate with you about your itinerary, booking confirmations, updates, and customer support.",
            "Customise your travel experience.",
            "Send marketing and promotional communications, where you have given consent.",
            "Improve our website, services, and customer experience.",
            "Prevent fraud, protect our legal rights, and comply with legal obligations.",
          ] },
        ],
      },
      {
        heading: "3. Legal basis for processing",
        body: [
          "We process personal data where:",
          { list: [
            "It is necessary to fulfil a contract with you.",
            "You have given consent.",
            "It is necessary for our legitimate business interests.",
            "It is required by applicable law.",
          ] },
        ],
      },
      {
        heading: "4. Sharing and disclosure",
        body: [
          "We may share your information with:",
          { list: [
            "Travel suppliers such as airlines, hotels, tour operators, transport providers, and insurance companies.",
            "Payment processors and financial institutions.",
            "IT, cloud storage, and website service providers.",
            "Legal, accounting, and professional advisers.",
            "Government authorities, regulators, or law enforcement where required by law.",
            "A buyer or successor in the event of a merger, sale, or transfer of business assets.",
          ] },
          "We do not sell your personal information to third parties.",
        ],
      },
      {
        heading: "5. Data retention",
        body: [
          "We retain personal information only for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce agreements. When information is no longer required, we securely delete or anonymise it.",
        ],
      },
      {
        heading: "6. Data security",
        body: [
          "We use appropriate technical and organisational measures to protect your personal information from unauthorised access, loss, misuse, or disclosure. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Depending on your location, you may have the right to:",
          { list: [
            "Access the personal information we hold about you.",
            "Request correction of inaccurate or incomplete information.",
            "Request deletion of your personal information.",
            "Object to or restrict certain processing activities.",
            "Request data portability.",
            "Withdraw consent at any time, where processing is based on consent.",
            "Lodge a complaint with a relevant data protection authority.",
          ] },
          "To exercise any of these rights, please contact us using the details below.",
        ],
      },
      {
        heading: "8. Cookies and tracking technologies",
        body: [
          "We use cookies and similar technologies to improve website functionality, analyse traffic, and personalise content. You can manage or disable cookies through your browser settings. However, disabling cookies may affect the functionality of our website.",
        ],
      },
      {
        heading: "9. Third-party links",
        body: [
          "Our website may contain links to third-party websites or services. We are not responsible for the privacy practices or content of those third parties. We encourage you to read their privacy policies before providing any personal information.",
        ],
      },
      {
        heading: "10. Children's privacy",
        body: [
          "Our services are intended for adults. We do not knowingly collect personal information from children under the age of 18 without verifiable parental consent. If you believe a child has provided us with personal information, please contact us.",
        ],
      },
      {
        heading: "11. International data transfers",
        body: [
          "Your information may be transferred to, stored, or processed in countries other than your own. These countries may have different data protection laws. We take reasonable steps to ensure appropriate safeguards are in place.",
        ],
      },
      {
        heading: "12. Contact us",
        body: [
          "If you have any questions or concerns about this Privacy Policy or how your data is handled, please contact us using the contact page on our website or the details provided in your booking confirmation.",
          `Email ${CONTACT_EMAIL} or message ${WHATSAPP_DISPLAY}.`,
        ],
      },
    ],
  },

  terms: {
    title: "Terms of Service",
    intro: ACCEPTANCE,
    sections: [
      {
        heading: "1. Acceptance of terms",
        body: [
          "These Terms of Service govern your use of the BGS Travel and Tourism website and services. By accessing our website, making a booking, or using our services, you agree to be bound by these Terms. If you do not agree, you must not use our website or services.",
        ],
      },
      {
        heading: "2. Services",
        body: [
          "BGS Travel and Tourism provides travel planning, booking, and related tourism services. We may act as an agent or intermediary between you and third-party suppliers such as airlines, hotels, tour operators, and transport providers.",
        ],
      },
      {
        heading: "3. Bookings and payments",
        body: [
          { list: [
            "All bookings are subject to availability and confirmation by the relevant supplier.",
            "A booking is confirmed only after we receive full payment or a required deposit and issue a confirmation.",
            "Prices are quoted in the currency stated and may change until full payment is received.",
            "You must provide accurate, complete, and current information at the time of booking.",
            "You are responsible for reviewing all booking details and confirming their accuracy.",
          ] },
        ],
      },
      {
        heading: "4. Cancellations and refunds",
        body: [
          { list: [
            "Cancellation and refund policies vary by supplier and booking type.",
            "Cancellation fees may apply, and some bookings may be non-refundable.",
            "No-shows, unused services, or partially used bookings may not be eligible for refunds.",
            "Refunds, where applicable, will be processed within 14 business days after approval.",
            "BGS Travel and Tourism is not responsible for supplier delays in processing refunds.",
          ] },
        ],
      },
      {
        heading: "5. Travel documents and responsibilities",
        body: [
          { list: [
            "You are responsible for ensuring you have a valid passport, visa, travel insurance, and any required health documents or vaccinations.",
            "We may assist with information about travel requirements, but it is your responsibility to verify and comply with all entry, exit, health, and safety requirements.",
            "You are responsible for arriving on time for all flights, transfers, tours, and other travel arrangements.",
            "You must comply with the rules and policies of all travel suppliers.",
          ] },
        ],
      },
      {
        heading: "6. Third-party suppliers",
        body: [
          "BGS Travel and Tourism acts as an agent for third-party suppliers. We are not responsible for the acts, omissions, delays, cancellations, overbooking, equipment failures, or negligence of those suppliers. Your booking with a third-party supplier is also subject to that supplier's terms and conditions.",
        ],
      },
      {
        heading: "7. Limitation of liability",
        body: [
          "To the maximum extent permitted by law:",
          { list: [
            "BGS Travel and Tourism shall not be liable for any indirect, incidental, special, consequential, or punitive damages.",
            "Our total liability for any claim arising out of or relating to our services shall not exceed the amount paid by you to BGS Travel and Tourism for the specific service giving rise to the claim.",
            "We are not liable for losses caused by events beyond our reasonable control, including but not limited to natural disasters, acts of government, war, terrorism, strikes, pandemics, or supplier failure.",
          ] },
        ],
      },
      {
        heading: "8. Force majeure",
        body: [
          "BGS Travel and Tourism shall not be liable for any failure or delay in performing its obligations if such failure or delay is caused by events beyond its reasonable control, including but not limited to natural disasters, severe weather, acts of God, war, terrorism, civil unrest, government restrictions, pandemics, strikes, or failure of third-party suppliers.",
        ],
      },
      {
        heading: "9. Intellectual property",
        body: [
          "All content on the BGS Travel and Tourism website, including text, graphics, logos, images, videos, and software, is the property of BGS Travel and Tourism or its licensors and is protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works without our prior written consent.",
        ],
      },
      {
        heading: "10. Prohibited conduct",
        body: [
          "You agree not to:",
          { list: [
            "Use the website or services for any unlawful purpose.",
            "Attempt to gain unauthorised access to our systems or data.",
            "Interfere with the normal operation of the website.",
            "Provide false, misleading, or fraudulent information.",
            "Use automated systems to scrape or extract data without permission.",
          ] },
        ],
      },
      {
        heading: "11. Indemnification",
        body: [
          "You agree to indemnify, defend, and hold harmless BGS Travel and Tourism, its directors, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses arising out of or related to your use of the website or services, your breach of these Terms, or your violation of any law or third-party right.",
        ],
      },
      {
        heading: "12. Modifications to terms",
        body: [
          "We may update these Terms from time to time. The updated version will be posted on our website with a new effective date. Your continued use of the website or services after changes are posted constitutes acceptance of the revised Terms.",
        ],
      },
      {
        heading: "13. Governing law and dispute resolution",
        body: [
          "These Terms shall be governed by and construed in accordance with the laws of the United Arab Emirates. Any dispute arising out of or relating to these Terms or our services shall be subject to the exclusive jurisdiction of the courts of the United Arab Emirates.",
        ],
      },
      {
        heading: "14. Severability",
        body: [
          "If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.",
        ],
      },
      {
        heading: "15. Entire agreement",
        body: [
          "These Terms, together with our Privacy Policy and any booking confirmation or agreement, constitute the entire agreement between you and BGS Travel and Tourism regarding the use of our website and services.",
        ],
      },
      {
        heading: "16. Contact",
        body: [
          "For questions about these Terms, please contact us using the contact page on our website or the details provided in your booking confirmation.",
          `Email ${CONTACT_EMAIL} or message ${WHATSAPP_DISPLAY}.`,
        ],
      },
    ],
  },
};

/**
 * The order the buttons appear in, so markup and content cannot disagree.
 * Cookies has no button of its own — the supplied policy covers them under
 * Privacy section 8, and a second door onto the same paragraph is just a way
 * for the two to fall out of step.
 */
export const LEGAL_LINKS = [
  { key: "privacy", label: "Privacy" },
  { key: "terms", label: "Terms" },
];
