# Landlord Dashboard — Feature Spec

## Overview
The landlord dashboard lets property owners and managers claim buildings, monitor violations and complaints, and respond to tenant concerns. It consists of a signup flow, main dashboard, and building claim process.

## Routes

### `/landlord/signup`
- **Not logged in**: Google OAuth sign-in prompt with value proposition
- **Logged in, no profile**: Signup form (company name, email, phone)
- **Logged in, has profile**: Redirect to `/landlord/dashboard`

### `/landlord/dashboard`
- **Auth gate**: Redirects to signup if not logged in or no landlord profile
- **Profile header**: Company name, email, plan badge, verification status
- **Stats row**: Buildings count, pending claims count, alerts count
- **Buildings list**: Address, verification status badge, role, date, link to public page
- **Claim a Building**: Inline flow — search address → preview violations/complaints/permits → select role → submit
- **Recent Alerts**: Last 10 alerts with type, title, severity, timestamp

## Database Tables
- `landlord_profiles` — user_id, company_name, contact_email, phone, plan, verified
- `claimed_buildings` — landlord_id, address, verification_status, claimant_role, units
- `landlord_alerts` — landlord_id, building_id, alert_type, title, severity, read

## Claim Flow
1. Search by address (autocomplete via Chicago violations API)
2. Select address → preview violation, complaint, and permit counts
3. Choose role (Owner / Property Manager / Management Company) and optional unit count
4. Submit → creates claimed_building with verification_status='pending'
5. Verification is manual (admin approves/rejects)

## Plans
- **Free**: Up to 3 buildings, basic alerts
- **Basic**: Up to 10 buildings, email alerts (future)
- **Pro**: Unlimited buildings, priority support (future)

## Future Phases
- Prompt 4: Alert detail page, alert generation cron
- Prompt 5: Building detail page, verified badge on public pages
- Phase 3: Settings page, building score calculation
- Phase 4: Stripe billing integration
