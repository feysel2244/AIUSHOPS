import { Link, useLocation } from "react-router-dom";

const CONTACT_PEOPLE = [
  {
    name: "Fesel Anwar surur",
    email: "feyselanwar2244@gmail.com",
    linkedin: "https://www.linkedin.com/in/feysel-anwar-a536a7335/",
  },
  {
    name: "Naeem Abbas",
    email: "nayeemabbas313@gmail.com",
    linkedin: "https://www.linkedin.com/in/naeemabbas313?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app",
  },
  {
    name: "Ali Ibtisam",
    email: "aliibtisam1001@gmail.com",
    linkedin: "https://www.linkedin.com/in/aliibtisam1001",
  },
];

const CONTENT: Record<
  string,
  {
    title: string;
    intro: string;
    sections: { heading: string; text: string }[];
  }
> = {
  "/about": {
    title: "About AIU Market",
    intro:
      "AIU Market is a student-focused marketplace for Albukhary International University, created to make it easier for students to discover, buy, sell, and offer services within the campus community.",
    sections: [
      {
        heading: "Our purpose",
        text:
          "AIU Market brings student sellers and student buyers together in one place. Approved sellers can create shops, publish products or services, manage orders, and communicate with buyers, while buyers can browse campus listings and place orders or service requests.",
      },
      {
        heading: "Built for the AIU community",
        text:
          "The marketplace is designed around practical campus needs such as pickup locations, student-run services, direct seller payments, reviews, notifications, and seller management. AIU Market is intended to support student entrepreneurship while keeping transactions clear and responsible.",
      },
      {
        heading: "Student responsibility",
        text:
          "AIU Market provides the marketplace tools but does not guarantee the quality, availability, legality, or performance of an individual seller's product or service. Buyers and sellers are responsible for communicating clearly and completing transactions honestly.",
      },
    ],
  },

  "/how-it-works": {
    title: "How It Works",
    intro:
      "AIU Market connects students through a simple campus marketplace workflow.",
    sections: [
      {
        heading: "1. Browse",
        text:
          "Browse approved student shops, products, and services. Use categories and search to find something suitable for your needs.",
      },
      {
        heading: "2. Order or request a service",
        text:
          "Products can be added to your cart. Services can be requested with a preferred date, time, meeting method, and any notes the seller needs.",
      },
      {
        heading: "3. Payment",
        text:
          "For pay-now orders, the seller's QR code or bank details are shown during checkout. The buyer must upload a payment proof image before confirming that payment has been made. For pay-on-pickup orders, payment is collected directly from the seller at the agreed time.",
      },
      {
        heading: "4. Seller confirmation",
        text:
          "Sellers receive order notifications, review requests, verify payments when applicable, and update the order status as the order progresses.",
      },
      {
        heading: "5. Review",
        text:
          "After a completed transaction, buyers can leave a review to help other students make informed decisions.",
      },
    ],
  },

  "/resources": {
    title: "Resources",
    intro:
      "Useful guidance for buyers and sellers using AIU Market.",
    sections: [
      {
        heading: "Buyer safety",
        text:
          "Check the seller profile, listing details, price, availability, pickup or meeting arrangements, and payment information before confirming an order. Keep payment proofs and order information until the transaction is complete.",
      },
      {
        heading: "Seller guidance",
        text:
          "Use accurate listing titles, descriptions, prices, stock or availability information, turnaround times, and included-service details. Keep your payment QR code and bank information current and respond to buyer requests promptly.",
      },
      {
        heading: "Payment proof",
        text:
          "AIU Market records buyer-submitted payment proof for pay-now orders so sellers can verify the payment. A payment proof upload is not itself a guarantee that funds were received; sellers should verify the transaction in their own banking or e-wallet account.",
      },
      {
        heading: "Support",
        text:
          "For account, order, seller application, or marketplace issues, use the Contact page and provide the order or shop information needed to investigate the issue.",
      },
    ],
  },

  "/contact": {
    title: "Contact Us",
    intro:
      "Need help with an order, listing, account, seller application, or marketplace issue?",
    sections: [
      {
        heading: "Marketplace support",
        text:
          "When contacting AIU Market support, include your account email, order code, shop name, or listing name when relevant. This helps the marketplace team identify the correct record and investigate the issue faster.",
      },
      {
        heading: "Order problems",
        text:
          "For an order that is delayed, rejected, incorrectly marked, or disputed, keep your order code and payment proof available. Buyers should contact the seller first for ordinary order coordination and use marketplace support when the platform record itself needs attention.",
      },
      {
        heading: "Seller problems",
        text:
          "Seller applications, listing problems, payment QR issues, promotion submissions, and dashboard problems should include the seller account email and shop name when support is requested.",
      },
      {
        heading: "Community standards",
        text:
          "AIU Market may review reports involving fraud, harassment, misleading listings, prohibited goods, payment disputes, or misuse of the platform. Accounts or listings may be restricted when necessary to protect the campus marketplace.",
      },
    ],
  },

  "/terms": {
    title: "Terms of Use",
    intro:
      "These Terms of Use govern access to and use of AIU Market, the student marketplace for Albukhary International University.",
    sections: [
      {
        heading: "1. Eligibility and accounts",
        text:
          "AIU Market is intended for the AIU student community and authorized users. You are responsible for providing accurate account information, protecting your login credentials, and using your own account. You must not impersonate another person or create an account using false information.",
      },
      {
        heading: "2. Seller responsibilities",
        text:
          "Sellers must provide truthful product and service information, accurate prices, availability, pickup or meeting details, and payment information. Sellers are responsible for fulfilling accepted orders and service requests and for keeping listings up to date.",
      },
      {
        heading: "3. Buyer responsibilities",
        text:
          "Buyers must provide accurate order information, communicate respectfully, follow agreed pickup or service arrangements, and submit truthful payment confirmations. A buyer must not falsely claim to have paid.",
      },
      {
        heading: "4. Payments",
        text:
          "AIU Market may facilitate the presentation of seller payment QR codes or bank details, but direct buyer-to-seller payments are made to the seller rather than held by AIU Market. A buyer-submitted payment proof is evidence of a claimed payment and does not by itself prove that the seller received the funds.",
      },
      {
        heading: "5. Listings and prohibited use",
        text:
          "Listings must be lawful, accurate, and appropriate for the campus community. Users must not list fraudulent, stolen, dangerous, prohibited, or misleading goods or services, manipulate reviews, abuse promotions, spam other users, or use the platform for unlawful activity.",
      },
      {
        heading: "6. Orders and disputes",
        text:
          "Sellers and buyers should communicate promptly when an order cannot be completed. AIU Market may review transaction records, notifications, payment proofs, and account activity when investigating reports. Platform actions do not replace any legal rights a user may have.",
      },
      {
        heading: "7. Reviews and content",
        text:
          "Reviews and other user content must be truthful, relevant, and respectful. Users must not post defamatory, abusive, deceptive, or irrelevant content. AIU Market may remove content that violates these rules.",
      },
      {
        heading: "8. Shop approval and removal",
        text:
          "Seller applications are subject to review. AIU Market may reject, suspend, restrict, or remove a shop or listing when information is misleading, rules are violated, or action is necessary to protect users and the marketplace.",
      },
      {
        heading: "9. Availability and changes",
        text:
          "AIU Market is provided as a marketplace service and may occasionally be unavailable for maintenance, updates, or technical reasons. Features, policies, and marketplace rules may be updated when necessary.",
      },
      {
        heading: "10. Acceptance",
        text:
          "By creating an account, submitting an order, applying to become a seller, or using AIU Market, you acknowledge these Terms of Use and agree to use the marketplace responsibly.",
      },
    ],
  },

  "/privacy": {
    title: "Privacy Policy",
    intro:
      "This Privacy Policy explains how AIU Market handles information used to operate the campus marketplace.",
    sections: [
      {
        heading: "1. Information we handle",
        text:
          "Depending on how you use the platform, AIU Market may handle account information such as your name, email, department, year of study, WhatsApp number, profile image, seller shop information, listing information, orders, reviews, notifications, and marketplace preferences.",
      },
      {
        heading: "2. Payment information",
        text:
          "Seller payment QR images and bank or e-wallet details are displayed to buyers when needed to complete direct payments. Buyer payment proof images may be stored with the related order so the seller and authorized marketplace administrators can verify the reported payment.",
      },
      {
        heading: "3. How information is used",
        text:
          "Information is used to authenticate users, operate shops, process orders and service requests, provide notifications, display listings, support reviews, administer promotions, investigate reports, prevent abuse, and maintain the marketplace.",
      },
      {
        heading: "4. Sharing within the marketplace",
        text:
          "Some information is intentionally visible to other marketplace users. For example, a seller's shop name, listing details, pickup location, and relevant contact information may be shown to buyers. Private account and administrative information is restricted according to platform permissions.",
      },
      {
        heading: "5. Storage and security",
        text:
          "AIU Market uses Supabase services and related storage to operate its database, authentication, realtime notifications, and uploaded marketplace images. Access controls and database security policies are used to limit access to protected records.",
      },
      {
        heading: "6. Your choices",
        text:
          "You may review and update supported account information through your account or seller dashboard. Sellers can manage their listings and payment information, and can deactivate their shop through seller settings. If you need help with information associated with your account, contact marketplace support.",
      },
      {
        heading: "7. Retention",
        text:
          "Some information may need to remain available after a shop or listing is removed so that transaction history, reviews, accounting records, fraud prevention, and marketplace administration can continue to function.",
      },
      {
        heading: "8. Policy updates",
        text:
          "This policy may be updated when AIU Market changes its features, security practices, or legal requirements. The current version shown on this page applies to use of the marketplace.",
      },
    ],
  },
};

export default function SupportPage() {
  const { pathname } = useLocation();
  const page = CONTENT[pathname] ?? CONTENT["/about"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="bg-white rounded-2xl border border-stone-100 p-6 md:p-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1C3270] mb-3">
            AIU Market
          </p>

          <h1
            className="text-3xl md:text-4xl font-bold text-stone-900 mb-4"
            style={{ fontFamily: "Lora, serif" }}
          >
            {page.title}
          </h1>

          <p className="text-stone-600 leading-7 mb-8">
            {page.intro}
          </p>

          {/* Three Contact People */}
          {pathname === "/contact" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {CONTACT_PEOPLE.map((person) => (
                <div
                  key={person.email}
                  className="bg-stone-50 border border-stone-100 rounded-xl p-5"
                >
                  <h2
                    className="text-lg font-bold text-stone-900 mb-4"
                    style={{ fontFamily: "Lora, serif" }}
                  >
                    {person.name}
                  </h2>

                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-start gap-2 text-sm text-stone-600 hover:text-[#1C3270] transition-colors mb-3"
                  >
                    <span className="flex-shrink-0">
                      ✉
                    </span>

                    <span className="break-all">
                      {person.email}
                    </span>
                  </a>

                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#1C3270] hover:underline"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-[#1C3270] text-white text-xs font-bold">
                      in
                    </span>

                    LinkedIn
                  </a>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-7">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-bold text-stone-900 mb-2">
                  {section.heading}
                </h2>

                <p className="text-sm text-stone-600 leading-7">
                  {section.text}
                </p>
              </section>
            ))}
          </div>

          <Link
            to="/"
            className="inline-block mt-10 text-sm font-medium text-[#1C3270] hover:underline"
          >
            ← Back to marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
