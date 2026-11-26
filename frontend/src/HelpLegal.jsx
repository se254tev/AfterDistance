import { Link } from 'react-router-dom';

const supportNumber = '254797819571';
const supportDisplay = '+254 797 819 571';

function contactUrl(category) {
  const message = `Hello AfterDistance Support, I need assistance with ${category}.`;
  return `https://wa.me/${supportNumber}?text=${encodeURIComponent(message)}`;
}

function CentreNav({ active }) {
  const links = [
    ['help', '/help', 'Help & How to Play'],
    ['copyright', '/copyright', 'Copyright'],
    ['privacy', '/privacy-policy', 'Privacy Policy'],
    ['terms', '/terms', 'Terms of Use'],
    ['contact', '/contact', 'Contact Us']
  ];
  return <nav className="centre-nav" aria-label="Help, Legal and Contact pages">
    {links.map(([key, to, label]) => <Link key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} to={to}>{label}</Link>)}
  </nav>;
}

function Page({ active, title, eyebrow, children }) {
  return <section className="centre-page">
    <header className="centre-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
    <CentreNav active={active} />
    <article className="centre-content">{children}</article>
    <Link className="text-button centre-back" to="/">Return to AfterDistance</Link>
  </section>;
}

function HelpPage() {
  return <Page active="help" title="Help & How to Play" eyebrow="AFTERDISTANCE GUIDE">
    <section>
      <h2>What is AfterDistance?</h2>
      <p>AfterDistance is a real-time, private two-player multiplayer experience designed to bring people together through questions, predictions, comedy, romance and interactive challenges.</p>
      <p className="centre-tagline">Two Hearts. Two Locations. One Shared World.</p>
    </section>
    <section>
      <h2>Creating a game</h2>
      <ol>
        <li>Open AfterDistance and select <b>Create a room</b>.</li>
        <li>Choose a nickname from 2 to 24 characters.</li>
        <li>The application creates a 12-character room code and a private guest session.</li>
        <li>Invite your partner using WhatsApp, an invitation link or the room code.</li>
      </ol>
    </section>
    <section>
      <h2>Inviting someone</h2>
      <p>AfterDistance supports three invitation methods:</p>
      <ol>
        <li><b>WhatsApp invitation:</b> open the share link and send it to your partner.</li>
        <li><b>Copy invitation link:</b> copy and send the direct `/join` link.</li>
        <li><b>Room code:</b> share the 12-character code and ask your partner to select Join a room, enter the code and choose a nickname.</li>
      </ol>
    </section>
    <section>
      <h2>Joining and getting ready</h2>
      <p>An invited player can open the invitation link or enter the room code manually. Only two players can join the same room. Once both players are present, both must mark themselves ready before a game can begin.</p>
    </section>
    <section>
      <h2>Playing the game</h2>
      <p>AfterDistance uses five-round games. Each round presents a shared question or challenge. Players privately submit an answer and then a prediction about their partner’s choice. Answers and predictions are withheld until both required submissions complete, when the server reveals both choices simultaneously.</p>
      <p>The server awards points, records round results and achievements, and displays final scores after the fifth round. Players can then replay with previously unused questions where enough questions remain.</p>
      <p>Some rounds use story or quiz styles. The server validates submissions and timers; unanswered selections are treated as unanswered when a timer expires.</p>
    </section>
    <section>
      <h2>Game modes and content</h2>
      <p>The available experiences are <b>The Other Side of Us</b> and <b>Kenyan Comedy Experience</b>. Kenyan games support Comedy, Romance, Savage, and Mind Reader modes. The implemented categories include Mixed, Funny Predictions, Complete the Story, Truth or Bluff, Who Is More Likely, Sheng Battle, Romantic Comedy and Mini Challenge.</p>
      <p>Kenyan content packs include Matatu Madness, Choma na Story, Campus Chronicles, Nairobi Vibes, Mapenzi na Drama and Sheng Central. Language choices are English, Kiswahili, Sheng or Mixed Kenyan Language. Optional answer timers are 10, 15 or 20 seconds; the timer can also be disabled.</p>
    </section>
    <section>
      <h2>Refresh, reconnection and connectivity</h2>
      <p>Your guest credential and room code are saved in browser storage. Refreshing or reopening AfterDistance allows the app to validate the saved session and offer resume access while the room remains active. Use the same browser profile and keep the room available.</p>
      <p>If your internet connection drops temporarily, the game attempts to reconnect. Changes that reach the server are server-authoritative, while pending or unconfirmed submissions may be lost. If a room expires or is deleted, recovery may not be available.</p>
    </section>
    <section>
      <h2>Return Home</h2>
      <p>Return Home preserves the guest session and active room so it can be resumed while valid. It does not delete the game.</p>
    </section>
    <section>
      <h2>Managing personal data</h2>
      <ul>
        <li><b>Leave Current Game:</b> disconnect and mark yourself offline without deleting your guest session or saved room.</li>
        <li><b>Delete My Data:</b> remove your guest identity and personal linked activity, invalidate your session and reset shared in-progress play for the surviving room.</li>
        <li><b>Delete All My Data:</b> run the session-wide live-data cleanup across AfterDistance collections.</li>
        <li><b>Delete This Game:</b> only the authenticated room creator can delete the shared room and progress for both players.</li>
      </ul>
      <p>Open <Link to="/privacy">Privacy &amp; Data Management</Link> for the in-app controls.</p>
    </section>
  </Page>;
}

function CopyrightPage() {
  return <Page active="copyright" title="Copyright Protection" eyebrow="PROPRIETARY RIGHTS">
    <section>
      <h2>Ownership</h2>
      <p>Subject to applicable law and any third-party rights, AfterDistance retains ownership of its original software, source code, application design, graphics, branding, original game content, questions, text, illustrations and other original materials. Ownership is not established by this page for any third-party material or for content submitted by users.</p>
    </section>
    <section>
      <h2>Permitted use</h2>
      <p>Users may access and use AfterDistance for its intended personal and recreational purposes, consistent with these terms and applicable law.</p>
    </section>
    <section>
      <h2>Restrictions</h2>
      <p>Without the required permission, users must not copy or redistribute substantial portions of proprietary game content, reproduce the application for commercial distribution, reverse engineer or extract protected source code except where permitted by law, use the AfterDistance name or branding misleadingly, republish original questions or illustrations as their own, or remove applicable copyright notices or attribution.</p>
    </section>
    <section>
      <h2>User-submitted content</h2>
      <p>Players retain applicable rights to content they create or submit. By submitting content to use the service, players grant AfterDistance the permissions reasonably necessary to process, transmit and display that content to the relevant players and to operate and improve the application, subject to the Privacy Policy and applicable law. AfterDistance does not claim ownership of every answer or message submitted by a player.</p>
    </section>
    <section>
      <h2>Third-party materials</h2>
      <p>Third-party names, trademarks, software, hosting materials and other third-party assets remain the property of their respective owners.</p>
    </section>
    <section>
      <h2>Copyright complaints</h2>
      <p>Suspected infringement can be reported through the official support WhatsApp: <a href={contactUrl('a copyright complaint')} target="_blank" rel="noopener noreferrer">{supportDisplay}</a>. Include the material concerned, where it appears, and enough information for the complaint to be reviewed.</p>
      <p>This page uses the Copyright Act, 2001 (Kenya), as amended. It does not identify a copyright registration number or assert that one has been obtained.</p>
    </section>
  </Page>;
}

function PrivacyPolicyPage() {
  return <Page active="privacy" title="Data Protection & Privacy Policy" eyebrow="GUEST DATA NOTICE">
    <section>
      <h2>Information we collect</h2>
      <p>AfterDistance stores or processes:</p>
      <ul>
        <li>The nickname entered by a guest player.</li>
        <li>A random guest session identifier and its room membership.</li>
        <li>The 12-character room code and room expiry time.</li>
        <li>Ready status, online status and server-side game participation.</li>
        <li>Game configuration, private answers and predictions, round results, scores and achievements.</li>
        <li>Deletion status markers that contain session hashes and room-deletion metadata, not raw guest tokens.</li>
      </ul>
      <p>The application does not confirm collection of payment data, verified identity documents, an email address or a general account profile. Connection metadata may be handled by the hosting provider, but this application does not currently expose a separate analytics or advertising profile.</p>
    </section>
    <section>
      <h2>Why information is used</h2>
      <p>Information is used to create and manage rooms, identify the guest participating in a room, synchronize multiplayer state, restore valid game progress, calculate scores and achievements, enforce room membership and security, and support reliability and deletion controls.</p>
    </section>
    <section>
      <h2>How information is stored</h2>
      <p>MongoDB Atlas stores guest sessions, room snapshots, game sessions and final results when persistence is configured. Browser <code>localStorage</code> stores the guest session credential, room code and nickname for refresh recovery. Legacy tab storage may be migrated to durable browser storage and both stored copies are cleared when session data is deleted.</p>
    </section>
    <section>
      <h2>Sharing and visibility</h2>
      <p>The two room players see nicknames, ready and online status, shared questions, reveal results, scores and earned achievements. Private answers and predictions remain out of the partner’s public game projection until reveal. Raw guest session credentials are not displayed in the game view or sent in invitation links.</p>
      <p>Third-party infrastructure may include Netlify for the static frontend, Render for the application service and MongoDB Atlas for database hosting. Their own infrastructure and applicable terms may apply.</p>
    </section>
    <section>
      <h2>Retention and expiration</h2>
      <p>Active rooms expire after 24 hours by the implemented application rule. Valid live records are recovered only when the room snapshot has not expired. Deleting personal or shared data removes the relevant live records and creates operational deletion markers. Atlas backup copies are not deleted automatically by the application and may remain until their own configured retention period expires.</p>
    </section>
    <section>
      <h2>Security</h2>
      <p>AfterDistance uses random guest tokens, server-side room membership checks, socket binding, payload validation, rate limits, authorization checks and secure deployment configuration. Private selections are excluded from public projections until reveal. No security measure can guarantee absolute protection against every risk.</p>
    </section>
    <section>
      <h2>User rights</h2>
      <p>Subject to the Constitution of Kenya, Article 31, the Data Protection Act, 2019 and applicable Data Protection Regulations, 2021, individuals may have the right to be informed about processing, request access to their personal data, object to certain processing, request correction of inaccurate or misleading information, request deletion where applicable, and use other remedies provided by law.</p>
      <p>Use the in-app data controls for guest-session deletion and contact support if you need help locating or correcting information.</p>
    </section>
    <section>
      <h2>Data deletion</h2>
      <p><b>Delete My Data</b> and <b>Delete All My Data</b> remove or scrub the requesting guest session and invalidate it. Shared in-progress records are reset while the other player’s independent guest identity is retained. <b>Leave Current Game</b> does not delete personal data. <b>Delete This Game</b> is available only to the room creator and deletes the shared room and progress for both players.</p>
    </section>
    <section>
      <h2>Children and minors</h2>
      <p>AfterDistance is a general recreational two-player experience and does not have an age-verification or guardian-consent process. Parents or guardians should supervise any minor’s participation and consider applicable legal protections.</p>
    </section>
    <section>
      <h2>Privacy questions and complaints</h2>
      <p>For privacy requests or concerns, contact <a href={contactUrl('a privacy and personal data request')} target="_blank" rel="noopener noreferrer">{supportDisplay}</a>. You may also consult the <a href="https://www.odpc.go.ke/" target="_blank" rel="noopener noreferrer">Office of the Data Protection Commissioner</a>.</p>
    </section>
  </Page>;
}

function TermsPage() {
  return <Page active="terms" title="User Agreement & Terms of Use" eyebrow="GUEST SERVICE TERMS">
    <section><h2>1. Acceptance</h2><p>By creating or joining a room or otherwise using AfterDistance, you agree to these terms to the extent applicable law permits. If you do not agree, do not use the service.</p></section>
    <section><h2>2. Description of the service</h2><p>AfterDistance is a real-time recreational experience for two players, offering questions, predictions, challenges, scoring and achievements.</p></section>
    <section><h2>3. Guest access and nicknames</h2><p>Use does not require a registered account, but the application creates a guest session and stores a nickname and room credential in browser and server data. You are responsible for protecting access to your browser session.</p></section>
    <section><h2>4. Two-player rooms</h2><p>A room is limited to two players. Room codes help identify rooms but do not grant every holder of a code unlimited authority to alter or delete the game.</p></section>
    <section><h2>5. Room creation and invitations</h2><p>You may create a room, invite a partner through the supported WhatsApp, link or code methods, and join an available room. Do not share a room or session credential with someone you do not intend to include.</p></section>
    <section><h2>6. Acceptable use</h2><p>Use AfterDistance personally and recreationally, follow room rules, respect other players and preserve the privacy and security of the service and its users.</p></section>
    <section><h2>7. Prohibited conduct</h2><p>You must not attempt unauthorized access to rooms or sessions, exploit vulnerabilities, manipulate scores or room state, automate abuse, bypass validation or rate limits, scrape private content, impersonate another participant or interfere with the game or service.</p></section>
    <section><h2>8. Respectful communication</h2><p>Do not use the application to harass, threaten, abuse, discriminate against or harm another player. Respectful communication is required even when a game mode contains playful or competitive content.</p></section>
    <section><h2>9. User-generated content</h2><p>You are responsible for the information, answers and content you submit and must have the applicable rights to submit it. Players retain applicable rights; the service needs limited permission to transmit and display submitted content for gameplay.</p></section>
    <section><h2>10. Intellectual property</h2><p>AfterDistance software and original protected materials remain subject to applicable copyright and intellectual-property law. Third-party materials belong to their owners. Nothing here transfers ownership from a player of their applicable user-created content.</p></section>
    <section><h2>11. Personal data and privacy</h2><p>Personal data is handled according to the <Link to="/privacy-policy">Data Protection &amp; Privacy Policy</Link>. Guest deletion and room deletion controls are available in <Link to="/privacy">Privacy &amp; Data Management</Link>.</p></section>
    <section><h2>12. Reconnection and interruptions</h2><p>Refresh and reconnection depend on valid browser credentials and a recoverable active room. Connectivity loss or service interruptions may prevent submissions or temporarily interrupt play.</p></section>
    <section><h2>13. Room expiration and deletion</h2><p>Rooms expire according to the implemented 24-hour room rule unless deleted earlier or removed by operational expiry. Game progress may become unavailable after expiration or shared-room deletion.</p></section>
    <section><h2>14. Service availability</h2><p>The service is provided as an application that may experience maintenance, outages, updates or temporary incompatibilities. Reasonable efforts may be made to preserve data and connections, but uninterrupted availability is not guaranteed.</p></section>
    <section><h2>15. Third-party services</h2><p>AfterDistance may depend on Netlify, Render, MongoDB Atlas and other third-party services. Their availability and terms are outside this application’s control.</p></section>
    <section><h2>16. Changes</h2><p>These terms may be updated as the service changes. Any updated version applies only as permitted by applicable law.</p></section>
    <section><h2>17. Suspension or termination</h2><p>Where justified, access to a room or the service may be suspended or removed to address unauthorized access, abuse, security risk or serious violations. These measures should respect applicable law and user rights.</p></section>
    <section><h2>18. Contact</h2><p>Contact AfterDistance through <a href={contactUrl('a general enquiry')} target="_blank" rel="noopener noreferrer">WhatsApp at {supportDisplay}</a>.</p></section>
    <section><h2>19. Governing law</h2><p>These terms are intended for use in Kenya and are governed by applicable Kenyan law, subject to mandatory rights and any court jurisdiction applicable to a dispute. No waiver of statutory rights is intended.</p></section>
  </Page>;
}

function ContactPage() {
  const categories = [
    ['General enquiries', 'a general enquiry'],
    ['Technical support', 'technical support'],
    ['Game issues', 'a game issue'],
    ['Privacy and personal data requests', 'a privacy and personal data request'],
    ['Copyright complaints', 'a copyright complaint'],
    ['Feedback and suggestions', 'feedback or a suggestion']
  ];
  return <Page active="contact" title="Contact Us" eyebrow="OFFICIAL SUPPORT CHANNEL">
    <section>
      <h2>WhatsApp</h2>
      <p><b>{supportDisplay}</b></p>
      <a className="button primary centre-whatsapp" href={contactUrl('application assistance')} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
    </section>
    <section>
      <h2>Choose a topic</h2>
      <p>These links open WhatsApp in a new tab with a relevant prefilled message.</p>
      <div className="contact-categories">
        {categories.map(([label, category]) => <a key={label} href={contactUrl(category)} target="_blank" rel="noopener noreferrer">{label}<span aria-hidden="true">→</span></a>)}
      </div>
    </section>
    <p className="centre-muted">AfterDistance does not publish an email address, physical office or additional telephone number in this application. No 24/7 availability or guaranteed response time is promised.</p>
  </Page>;
}

export function CentreRoute({ page }) {
  if (page === 'copyright') return <CopyrightPage />;
  if (page === 'privacy') return <PrivacyPolicyPage />;
  if (page === 'terms') return <TermsPage />;
  if (page === 'contact') return <ContactPage />;
  return <HelpPage />;
}
