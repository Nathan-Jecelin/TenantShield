-- Seed initial blog posts
-- Run after 20260219_blog_posts.sql

INSERT INTO blog_posts (slug, title, excerpt, content, published, created_at, updated_at)
VALUES

-- ═══════════════════════════════════════════════════════════════════════
-- POST 1: Building Violations Lookup
-- ═══════════════════════════════════════════════════════════════════════
(
  'how-to-check-building-violations-before-signing-a-lease-in-chicago',
  'How to Check Building Violations Before Signing a Lease in Chicago',
  'Building violations are official citations from the City of Chicago for code failures — and they can tell you a lot about the apartment you are about to rent. Here is how to look them up for free before you sign.',
  '<h2>Why Building Violations Matter More Than a Fresh Coat of Paint</h2>
<p>You found a great apartment in Lincoln Park. The photos look clean, the rent is fair, and the landlord seems friendly. But behind that fresh paint job could be a history of failed fire inspections, rodent infestations, or broken heating systems — all documented in the public record.</p>
<p><strong>Building violations</strong> are official citations issued by the City of Chicago''s Department of Buildings when a property fails to meet municipal code standards. They cover everything from structural defects to missing smoke detectors, and they are all public information. Checking them before you sign a lease is one of the smartest things you can do as a renter.</p>

<h2>What Exactly Are Building Violations?</h2>
<p>When a city inspector visits a property — whether responding to a complaint, conducting a routine inspection, or following up on a previous citation — they document every code failure they find. Each violation gets logged into the city''s database with details including:</p>
<ul>
  <li><strong>Violation date</strong> — when the inspector documented the issue</li>
  <li><strong>Violation type and description</strong> — what was wrong (e.g., "failure to maintain building in sound condition")</li>
  <li><strong>Inspector comments</strong> — the specific, on-the-ground observations (these are often the most revealing part)</li>
  <li><strong>Status</strong> — whether the violation is open (unresolved) or has been closed/complied with</li>
  <li><strong>Case number</strong> — for tracking through the administrative hearing process</li>
</ul>
<p>These are not just bureaucratic records. They are a paper trail that reveals how well a building has been maintained and how responsive a landlord is to problems.</p>

<h2>How to Look Up Building Violations on TenantShield</h2>
<p>You can search any Chicago address for free on <a href="/">TenantShield</a>. Here is how:</p>
<ul>
  <li><strong>Step 1:</strong> Go to <a href="/">mytenantshield.com</a> and type the address of the building you are considering into the search bar.</li>
  <li><strong>Step 2:</strong> TenantShield pulls building violations directly from the City of Chicago''s open data portal and displays them in a clean, readable format.</li>
  <li><strong>Step 3:</strong> Review each violation. Pay close attention to the <em>inspector comments</em> — they describe exactly what the inspector saw during their visit.</li>
  <li><strong>Step 4:</strong> Check the <em>status</em> column. Open violations mean the issue has not been resolved. Closed or complied violations mean the landlord addressed the problem.</li>
</ul>
<p>For example, try searching <a href="/address/1550-n-lake-shore-dr">1550 N Lake Shore Dr</a> to see what a building profile looks like with real data.</p>

<h2>What to Look For: Reading Violations Like a Pro</h2>
<h3>Open vs. Closed Violations</h3>
<p>A building with a handful of <em>closed</em> violations is not necessarily a red flag — it could mean the landlord responds to issues promptly. What you want to watch for is a pattern of <strong>open violations</strong>, especially ones that have been open for months or years. That suggests a landlord who ignores problems or drags their feet on repairs.</p>

<h3>Violation Types That Should Concern You</h3>
<p>Not all violations are equal. Here are the categories that matter most for renters:</p>
<ul>
  <li><strong>Fire safety violations</strong> — missing or non-functional smoke detectors, blocked exits, faulty fire escapes. These are life-safety issues.</li>
  <li><strong>Heating failures</strong> — especially if documented during winter months. Chicago landlords are legally required to maintain heat at 68°F during the day and 66°F at night from September 15 through June 1.</li>
  <li><strong>Pest infestations</strong> — inspector comments noting roaches, mice, rats, or bedbugs indicate ongoing maintenance neglect.</li>
  <li><strong>Structural problems</strong> — crumbling porches, water damage, foundation issues. These are expensive to fix, and landlords who ignore them are unlikely to address smaller concerns.</li>
  <li><strong>Plumbing and water issues</strong> — no hot water, sewage backups, or persistent leaks signal deferred maintenance.</li>
</ul>

<h3>Read the Inspector Comments</h3>
<p>The violation type alone only tells you the category. The <em>inspector comments</em> field is where you find the real story. An inspector might note "heavy roach infestation throughout kitchen and bathroom — evidence of long-term neglect" or "rear porch structurally unsound — immediate hazard." These details help you gauge severity in a way the violation code alone cannot.</p>

<h2>Red Flags That Should Make You Think Twice</h2>
<p>Based on what experienced Chicago renters and housing advocates look for, here are the warning signs:</p>
<ul>
  <li><strong>Dozens of open violations</strong> — a pattern of unaddressed code failures suggests systemic neglect.</li>
  <li><strong>Repeat violations for the same issue</strong> — if the same problem keeps getting cited, the landlord is doing the minimum to pass inspection and then letting things deteriorate again.</li>
  <li><strong>Recent fire safety or structural violations</strong> — these are the ones that directly threaten your safety.</li>
  <li><strong>No violations at all on an old building</strong> — this can actually be a yellow flag too. It may mean the building has never been inspected, which is not the same as being well-maintained.</li>
  <li><strong>Violations filed shortly before a unit was listed</strong> — a landlord scrambling to patch things up right before renting is different from one who maintains consistently.</li>
</ul>

<h2>What to Do With This Information</h2>
<p>Finding violations does not necessarily mean you should walk away. Here is how to use the data constructively:</p>
<ul>
  <li><strong>Ask the landlord about open violations directly.</strong> A responsible landlord will know about them and explain what is being done. A dismissive response is telling.</li>
  <li><strong>Document everything.</strong> Screenshot the violations you find on TenantShield. If you do sign the lease and problems arise, this record shows you did your due diligence — and that the landlord was on notice.</li>
  <li><strong>Negotiate.</strong> A building with known issues gives you leverage to request repairs as a condition of signing, or to negotiate rent.</li>
  <li><strong>Compare buildings.</strong> Search multiple addresses on <a href="/">TenantShield</a> to compare the violation histories of buildings you are considering.</li>
</ul>

<h2>Do Not Sign Blind</h2>
<p>In a competitive rental market, it is tempting to sign the first decent apartment you find. But five minutes on <a href="/">TenantShield</a> can save you from a year of headaches — or worse. Building violations are public for a reason: so tenants like you can make informed decisions.</p>
<p><strong><a href="/">Search any Chicago address for free on TenantShield</a></strong> and see what the city already knows about the building you are considering.</p>',
  true,
  '2026-02-19T10:00:00Z',
  '2026-02-19T10:00:00Z'
),

-- ═══════════════════════════════════════════════════════════════════════
-- POST 2: 311 Complaints
-- ═══════════════════════════════════════════════════════════════════════
(
  'what-chicago-311-complaints-tell-you-about-a-rental-property',
  'What Chicago 311 Complaints Tell You About a Rental Property',
  'Chicago''s 311 system logs every non-emergency service request made to the city — from rat sightings to broken elevators. Here is what those complaints reveal about a rental property and how to read them.',
  '<h2>What Is Chicago''s 311 System?</h2>
<p>If you have lived in Chicago for any amount of time, you have probably heard of 311. It is the city''s non-emergency service request system — the number residents call (or submit online) to report problems like potholes, broken streetlights, garbage issues, rodent sightings, and building complaints. Every single request gets logged into a public database with the address, the type of complaint, the date, and the resolution status.</p>
<p>For renters, this database is a goldmine. It tells you what people who actually live near (or in) a building have been dealing with — in their own reported words, preserved in city records. <a href="/">TenantShield</a> pulls this data automatically for any Chicago address you search.</p>

<h2>Building-Specific vs. Street-Level Complaints: Why the Distinction Matters</h2>
<p>Here is something most renters do not realize: not all 311 complaints filed at a given address are about the building itself. Many are about the surrounding street, sidewalk, or public infrastructure. This is a critical distinction.</p>

<h3>Building-specific complaints</h3>
<p>These are requests that reflect conditions <em>inside or directly caused by</em> the building. They include:</p>
<ul>
  <li><strong>Building code complaints</strong> — reports of code violations like no heat, no hot water, or broken common-area lighting</li>
  <li><strong>Rodent baiting requests</strong> — when someone reports rats or mice in or around the building</li>
  <li><strong>Garbage cart complaints</strong> — missing or damaged trash containers for the building</li>
  <li><strong>Water in basement/cellar</strong> — flooding issues within the property</li>
  <li><strong>Building or porch defects</strong> — structural complaints about the property itself</li>
  <li><strong>Elevator complaints</strong> — for larger buildings with elevator service</li>
</ul>
<p>These complaints tell you about <em>your potential landlord''s</em> responsiveness and the building''s condition. A pattern of building code complaints means tenants have been unhappy enough to contact the city — that is significant.</p>

<h3>Street-level complaints</h3>
<p>These are about the public infrastructure near the address but are not the landlord''s responsibility:</p>
<ul>
  <li>Pothole repairs</li>
  <li>Streetlight outages</li>
  <li>Graffiti removal</li>
  <li>Abandoned vehicles</li>
  <li>Tree trimming</li>
  <li>Alley maintenance</li>
  <li>Traffic signal issues</li>
</ul>
<p>Street-level complaints can still be useful — they tell you about the general condition of the block — but they should not be held against the landlord. A building at an address with 30 complaints might look alarming until you realize 25 of them are pothole reports.</p>

<h2>How TenantShield Separates Them</h2>
<p>When you <a href="/address/1550-n-lake-shore-dr">search an address on TenantShield</a>, the 311 complaints section includes filter buttons that let you toggle between:</p>
<ul>
  <li><strong>All</strong> — every 311 request at that address</li>
  <li><strong>Building</strong> — only complaints related to the building itself</li>
  <li><strong>Street</strong> — only street-level and infrastructure requests</li>
</ul>
<p>This makes it easy to focus on what actually matters for evaluating a rental. Start with the <em>Building</em> filter to see what tenants have reported about the property, then check <em>Street</em> to get a sense of the block''s condition.</p>

<h2>What Different Complaint Types Mean for Renters</h2>
<p>Here is a guide to the most common building-related 311 complaint types and what they signal:</p>

<h3>Building Code Complaints</h3>
<p>This is the big one. When someone files a building code complaint through 311, it often triggers a city inspection. Common reasons include no heat during winter, persistent water leaks, mold, broken locks on entry doors, and missing smoke detectors. If you see multiple building code complaints at an address, especially in recent years, it means tenants have had serious enough issues to formally report them.</p>

<h3>Rodent Complaints</h3>
<p>Rat and mouse complaints are common across Chicago, but frequency matters. A building with rodent baiting requests filed every few months suggests an ongoing problem that is not being resolved at its source. Check whether the complaints are clustered in time (might be a one-time issue) or spread out over years (chronic problem).</p>

<h3>Water and Flooding Complaints</h3>
<p>Reports of water in the basement or cellar are particularly important if you are considering a garden-level or basement apartment. Persistent flooding complaints indicate a drainage problem that is unlikely to be fixed cheaply or quickly.</p>

<h3>Garbage and Sanitation Complaints</h3>
<p>Repeated garbage-related complaints can signal a landlord who does not maintain basic services. While a single missed garbage pickup is meaningless, a pattern of complaints about overflowing dumpsters or missing carts points to poor property management.</p>

<h2>How to Read the Pattern, Not Just the Numbers</h2>
<p>Raw complaint counts can be misleading. Here is how to interpret the data thoughtfully:</p>
<ul>
  <li><strong>Look at the timeline.</strong> Are complaints clustered in a specific year, or spread consistently over time? A cluster might indicate a temporary problem (like a construction project nearby). Consistent complaints over years suggest systemic issues.</li>
  <li><strong>Check the status.</strong> Closed or completed complaints mean the city addressed the request. Open complaints might still be in progress — or might have been ignored.</li>
  <li><strong>Compare building vs. street complaints.</strong> A building with 40 total complaints but only 3 building-related ones is very different from one with 40 building complaints. TenantShield''s filter makes this comparison instant.</li>
  <li><strong>Consider the building size.</strong> A 200-unit high-rise will naturally generate more complaints than a 6-flat. Scale matters.</li>
  <li><strong>Cross-reference with violations.</strong> If 311 building code complaints at an address line up with formal building violations, it confirms a pattern. TenantShield shows both on the same page, making this easy.</li>
</ul>

<h2>What 311 Data Cannot Tell You</h2>
<p>It is worth noting the limitations. Not every problem gets reported to 311 — many tenants never bother, especially if they do not think it will help. A clean 311 record does not guarantee a problem-free building. It just means no one has filed a formal complaint. Use 311 data alongside building violations, tenant reviews, and your own in-person inspection of the unit.</p>

<h2>Search Before You Sign</h2>
<p>311 complaints are one of the most underused tools available to Chicago renters. They cost nothing to look up and can reveal problems that a 30-minute apartment tour never would. A landlord can stage a clean showing, but they cannot erase years of city records.</p>
<p><strong><a href="/">Search any Chicago address on TenantShield</a></strong> to see the full 311 complaint history — with building and street filters — alongside building violations, permits, and tenant reviews. It takes less than a minute, and it is completely free.</p>',
  true,
  '2026-02-19T11:00:00Z',
  '2026-02-19T11:00:00Z'
),

-- ═══════════════════════════════════════════════════════════════════════
-- POST 3: Chicago Tenant Rights 2026
-- ═══════════════════════════════════════════════════════════════════════
(
  'chicago-tenant-rights-what-every-renter-should-know-in-2026',
  'Chicago Tenant Rights: What Every Renter Should Know in 2026',
  'Chicago has some of the strongest tenant protections in the country under the RLTO. Here is a plain-language guide to your rights as a renter in 2026 — and what to do when your landlord violates them.',
  '<h2>Chicago Renters Have More Rights Than They Think</h2>
<p>If you rent in Chicago, you are protected by the <strong>Chicago Residential Landlord and Tenant Ordinance (RLTO)</strong> — one of the most comprehensive tenant protection laws in the United States. The problem is that most renters do not know what it says, and some landlords count on that.</p>
<p>This guide covers the rights that matter most in plain language: security deposits, repairs, lease requirements, and what to do when your landlord is not holding up their end of the deal. Whether you are signing your first Chicago lease or dealing with a problem landlord, this is the information you need for 2026.</p>

<h2>The RLTO: What It Is and Who It Covers</h2>
<p>The <a href="https://www.chicago.gov/city/en/depts/doh/provdrs/renters/svcs/rents-rights.html" rel="noopener noreferrer" target="_blank">Residential Landlord and Tenant Ordinance</a> is a Chicago city ordinance (not a state law) that applies to most rental units within city limits. It covers apartments, condos rented out by owners, and most single-family rentals. A few exceptions exist:</p>
<ul>
  <li>Owner-occupied buildings with six or fewer units (the owner must live in one of the units for this exemption to apply)</li>
  <li>Hotels, hospitals, and certain institutional housing</li>
  <li>Units in government-subsidized housing with their own regulatory framework</li>
</ul>
<p>If you are renting a standard apartment in Chicago from a landlord who does not live in the building (or who lives in a building with more than six units), the RLTO almost certainly applies to you.</p>

<h2>Security Deposit Rules</h2>
<p>Chicago''s security deposit rules are among the strictest in the country, and violations are common — often because landlords simply do not follow them. Here is what the law requires:</p>
<ul>
  <li><strong>Interest payments.</strong> Your landlord must pay you interest on your security deposit every year. The rate is set annually by the City Comptroller. The interest must be paid within 30 days after the end of each 12-month rental period, either as a direct payment or as a credit toward rent.</li>
  <li><strong>Separate account.</strong> Security deposits must be held in a federally insured interest-bearing account in an Illinois bank. The landlord cannot commingle your deposit with their own funds.</li>
  <li><strong>Return deadline.</strong> After you move out, the landlord has 30 days to either return your full deposit or provide an itemized statement of deductions with the remaining balance. If they miss this deadline, you may be entitled to the return of the full deposit plus penalties.</li>
  <li><strong>Penalties for violations.</strong> If your landlord fails to comply with any of these rules, you may be entitled to <strong>two times the security deposit amount</strong> plus interest, court costs, and reasonable attorney fees.</li>
</ul>
<p>This is one of the most frequently violated provisions of the RLTO. If your landlord has never paid you interest on your deposit, they may already be in violation.</p>

<h2>Your Right to a Habitable Home</h2>
<p>Under both the RLTO and Illinois law, your landlord is required to maintain the property in a habitable condition. This includes:</p>
<ul>
  <li><strong>Heat</strong> — landlords must maintain a minimum temperature of 68°F during the day (8:30 AM to 10:30 PM) and 66°F at night from September 15 through June 1. This is not optional.</li>
  <li><strong>Hot and cold running water</strong></li>
  <li><strong>Working plumbing, electrical, and gas systems</strong></li>
  <li><strong>Functioning smoke and carbon monoxide detectors</strong></li>
  <li><strong>Common areas maintained in safe and clean condition</strong></li>
  <li><strong>Pest control</strong> — the landlord is responsible for extermination of rodents and insects in common areas and, in most cases, within units</li>
  <li><strong>Working locks on all entry doors and windows</strong></li>
</ul>

<h2>Repair Rights: What to Do When Something Breaks</h2>
<p>When you need a repair, the RLTO gives you a clear process and real remedies if your landlord ignores you:</p>
<ul>
  <li><strong>Step 1: Notify your landlord in writing.</strong> Always put repair requests in writing — email counts. Be specific about the problem and keep a copy. This creates a dated record that you reported the issue.</li>
  <li><strong>Step 2: Give reasonable time for the repair.</strong> The RLTO specifies 14 days for non-emergency repairs. For emergencies (no heat in winter, gas leaks, flooding), the landlord must respond promptly.</li>
  <li><strong>Step 3: If the landlord does not respond, you have options.</strong> After the 14-day period, you may be entitled to:
    <ul>
      <li>Withhold rent in an amount that reasonably reflects the reduced value of the unit</li>
      <li>Hire a contractor to make the repair yourself and deduct the cost from rent (up to $500 or half of one month''s rent, whichever is greater)</li>
      <li>Terminate the lease if the issue is serious enough to make the unit unlivable</li>
    </ul>
  </li>
</ul>
<p><strong>Important:</strong> Before withholding rent or making repairs yourself, make sure you have documented everything. Written requests, photos, timestamps — the more evidence you have, the stronger your position if there is a dispute. Consider consulting with a tenant rights organization before taking action.</p>

<h2>Lease Requirements</h2>
<p>The RLTO requires landlords to include certain information in every lease:</p>
<ul>
  <li>The landlord''s name, address, and phone number (or the property manager''s, if applicable)</li>
  <li>The specific amount of rent, when it is due, and acceptable payment methods</li>
  <li>The amount of the security deposit and the name and address of the bank where it is held</li>
  <li>A copy of the city''s RLTO summary (landlords are required to attach this to every lease)</li>
</ul>
<p>If your lease does not include the RLTO summary, your landlord is already in violation of the ordinance.</p>

<h2>What to Do If Your Landlord Ignores Violations</h2>
<p>If your landlord is not maintaining the building and the city has documented violations, you have several paths forward:</p>
<ul>
  <li><strong>Document the violations.</strong> Use <a href="/">TenantShield</a> to <a href="/address/1550-n-lake-shore-dr">search your address</a> and see what the city has already documented. Screenshot the violations, complaint records, and any relevant inspector comments. This is public data that supports your case.</li>
  <li><strong>File a 311 complaint.</strong> If conditions violate the building code, file a complaint through 311 (call 311 or visit <a href="https://311.chicago.gov" rel="noopener noreferrer" target="_blank">311.chicago.gov</a>). This triggers a city inspection and creates an official record.</li>
  <li><strong>Contact a tenant rights organization.</strong> Several Chicago organizations offer free legal help and advice to tenants:
    <ul>
      <li><a href="https://www.tenants-rights.org" rel="noopener noreferrer" target="_blank">Metropolitan Tenants Organization (MTO)</a> — free hotline and advocacy</li>
      <li><a href="https://www.lcbh.org" rel="noopener noreferrer" target="_blank">Lawyers'' Committee for Better Housing (LCBH)</a> — free legal clinics</li>
      <li><a href="https://www.cityofchicago.org/city/en/depts/doh.html" rel="noopener noreferrer" target="_blank">Chicago Department of Housing</a> — information on tenant rights and resources</li>
    </ul>
  </li>
  <li><strong>Consider legal action.</strong> If your landlord is violating the RLTO, you may be entitled to damages. Small claims court handles cases up to $10,000, and many tenant rights attorneys work on contingency for RLTO violations.</li>
</ul>

<h2>How Public Records Support Your Rights</h2>
<p>One of the most powerful things you can do as a tenant is to know what the city already knows about your building. Building violations, 311 complaints, and permit records are all public data — and they are all searchable on <a href="/">TenantShield</a>.</p>
<p>This matters because:</p>
<ul>
  <li>If your landlord claims they "did not know" about a problem, city records may show they were cited for it.</li>
  <li>A documented history of violations strengthens any formal complaint or legal action you take.</li>
  <li>Permit records show whether the landlord has actually been making improvements or just collecting rent.</li>
</ul>
<p>Knowledge is leverage. A landlord who knows you are informed about city records and your legal rights is far more likely to respond to repair requests and maintain the property.</p>

<h2>Stay Informed, Stay Protected</h2>
<p>The RLTO exists because Chicago recognized that renters need real protections — not just suggestions. But those protections only work if you know about them and use them.</p>
<p>Before you sign a lease, <strong><a href="/">search the address on TenantShield</a></strong> to review the building''s violation and complaint history. If you are already renting and dealing with problems, look up your building to see what the city has documented — it may give you exactly the evidence you need.</p>
<p>For the full text of the RLTO, visit the <a href="https://www.chicago.gov/city/en/depts/doh/provdrs/renters/svcs/rents-rights.html" rel="noopener noreferrer" target="_blank">City of Chicago Department of Housing website</a>.</p>',
  true,
  '2026-02-19T12:00:00Z',
  '2026-02-19T12:00:00Z'
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  published = EXCLUDED.published,
  updated_at = now();
