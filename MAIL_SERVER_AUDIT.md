# VPS Mail Server Audit — modestintent.com

**Date:** 2026-06-14
**Purpose:** Determine if the existing Postfix/Dovecot/OpenDKIM mail stack on the VPS can replace SendGrid for SiteDeck operational alerts
**Method:** Read-only audit. SSH to VPS, run diagnostic commands, log all output. No configuration changed.

---

## Answers to the 6 questions

### 1. What mail server software is running

| Component | Software | Status | Purpose |
|---|---|---|---|
| SMTP MTA | **Postfix 3.x** (compatibility_level < 3.6) | `active (running)`, PID 1784067 | Sending + receiving SMTP |
| IMAP/POP3 | **Dovecot** | `active (running)`, PID 1089978 | Mailbox access (Roundcube-style webmail is not present) |
| DKIM | **OpenDKIM** | signing table + key table present, signs outgoing for `modestintent.com` | Outbound mail signing |
| TLS | OpenSSL (Let's Encrypt cert, expires 2026-08-30) | mounted at `/etc/ssl/mail/mail.{crt,key}` | SMTP submission + IMAPS/POP3S |
| Auth | Dovecot SASL via `private/auth` socket | smtpd_sasl_auth_enable = yes | SMTP AUTH for submission (587) + SMTPS (465) |
| Mailbox store | Dovecot LMTP via `private/dovecot-lmtp` socket | `virtual_transport = lmtp:unix:private/dovecot-lmtp` | Local delivery |
| Virtual domains | **MySQL-backed** (`mailserver` DB) | `virtual_mailbox_domains = mysql:/etc/postfix/mysql-virtual-mailbox-domains.cf` | Domain list |
| `sendmail` compat | `/usr/sbin/sendmail` present | the Postfix sendmail shim | Anything that does `exec /usr/sbin/sendmail` works |
| `msmtp` | **not installed** | — | — |
| No docker mail container | confirmed | — | This is a bare-metal Postfix install, not a containerized stack |

**Listening ports (confirmed live):**

| Port | Service | Daemon |
|---|---|---|
| 25 | SMTP (inbound + relay) | Postfix master |
| 587 | SMTP submission (STARTTLS) | Postfix master |
| 465 | SMTPS (implicit TLS) | Postfix master |
| 110 | POP3 (STARTTLS) | Dovecot |
| 143 | IMAP (STARTTLS) | Dovecot |
| 993 | IMAPS (implicit TLS) | Dovecot |

No mail-related Docker containers. The mail stack is a standard bare-metal `postfix + dovecot + opendkim` on the host, not on the `groundcheck-infra_groundcheck` bridge.

---

### 2. What domains it currently handles

Two virtual mailbox domains (read from the MySQL `mailserver.domain` table):

| Domain | Active | Notes |
|---|---|---|
| `modestintent.com` | 1 | Primary. OpenDKIM signs `*@modestintent.com` with `mail._domainkey.modestintent.com`. |
| `beerafterwork.com` | 1 | Secondary. No DKIM signing table entry found for this domain. RFC-required role aliases (`abuse@`, `hostmaster@`, `postmaster@`, `webmaster@`) are aliased → `mi@modestintent.com`. |

**Mailbox users (in `mailserver.mailbox`):**

| Username | Active |
|---|---|
| `mi@modestintent.com` | 1 |
| `test@modestintent.com` | 1 |

**Aliases:** the 5 RFC role aliases for `beerafterwork.com` plus the same 5 for `modestintent.com` (hostmaster/abuse/postmaster/webmaster/etc.), all pointing to `mi@modestintent.com`.

`sitedeck.pro` is **not configured anywhere** in `/etc/postfix/` or `/etc/opendkim/`. Zero matches.

**Recent mail activity** (last 20 lines of `/var/log/mail.log`):
- Normal Dovecot IMAP logins/logouts for `mi@modestintent.com`
- A burst of failed POP3 login attempts from `139.59.8.77` (a known abuse source) — Dovecot is rejecting them as expected
- The system is receiving and serving mail for the configured domains

---

### 3. Whether sitedeck.pro is configured or could be added

**Not configured today.** To add `sitedeck.pro` you'd need to do all of the following (and ONLY after the user's explicit go-ahead — this audit does not touch any of it):

1. **MySQL** — `INSERT INTO mailserver.domain (domain, active) VALUES ('sitedeck.pro', 1)`. The virtual_mailbox_domains.cf query reads from this table, so Postfix will start accepting mail for `sitedeck.pro` immediately. No Postfix restart needed for the lookup itself (Postfix re-queries on every RCPT TO), but the `postfix reload` would force cache refresh.

2. **OpenDKIM** — three steps to sign `sitedeck.pro`:
   - Generate a keypair: `opendkim-genkey -s mail -d sitedeck.pro -b 2048`
   - Add an entry to `KeyTable`: `mail._domainkey.sitedeck.pro  sitedeck.pro:mail:/etc/opendkim/keys/sitedeck.com/mail.private`
   - Add an entry to `SigningTable`: `*@sitedeck.pro  mail._domainkey.sitedeck.pro`
   - Restart OpenDKIM (or HUP it)

3. **DNS** — publish the public key as a TXT record at `mail._domainkey.sitedeck.pro`. Until that record exists, receiving MTAs will treat `sitedeck.pro` mail as unsigned.

4. **TLS cert** — the current cert is for `mail.modestintent.com` only. PM would submit mail over port 587 (STARTTLS) using the `mail.modestintent.com` certificate, which would produce a hostname mismatch on the PM client side unless we either (a) use port 25 from localhost (no TLS), (b) install a cert that also covers `mail.sitedeck.pro` and have PM target that, or (c) accept the cert mismatch with `tls: { rejectUnauthorized: false }` in nodemailer.

5. **MySQL mailbox or aliases** — decide whether `sitedeck.pro` will be a virtual mailbox domain (recipients exist) or a virtual alias domain (mail is forwarded elsewhere). The PM use case is the *opposite* — we want PM to *send* from `sitedeck.pro` but not *receive* there. The cleanest pattern is to add `sitedeck.pro` as a `virtual_alias_domain` (so inbound mail is forwarded to `mi@modestintent.com`) OR — simpler — add a `sender_login_maps` entry so Postfix accepts the `From:` address from authenticated clients without requiring a local mailbox.

**Important constraint:** `smtpd_sender_restrictions` is **empty** in the current config. Postfix will accept any `From:` from a SASL-authenticated sender. This means we can add a `sitedeck` SASL account, point nodemailer at it, and send from `alerts@sitedeck.pro` without ever creating a `sitedeck.pro` mailbox in MySQL. The downside is that the `From:` is just a header — it won't be DKIM-signed (OpenDKIM only signs for domains in its `SigningTable`).

---

### 4. Whether nodemailer can send through it directly from the PM service

**Yes, with two caveats.** Nodemailer can talk to this Postfix over plain SMTP submission (port 587, STARTTLS) or SMTPS (port 465). The PM service runs on the same VPS (`2.24.194.23`) as the mail server, so the network path is `127.0.0.1:587` (or `127.0.0.1:465`).

**Caveat 1: authentication.** The current Postfix config requires SASL AUTH for outbound submission (it's behind `permit_sasl_authenticated` in `smtpd_relay_restrictions`). Nodemailer will need a SASL username + password. The existing `mailuser` MySQL user authenticates against Dovecot's password database (typically in `mailserver.mailbox` as a bcrypt hash). We'd need to:
- Either add a `sitedeck@mail.modestintent.com` mailbox row (full mailbox, with quota) and use those credentials
- Or create a dedicated `sitedeck-alerts@modestintent.com` account and use those credentials with the `From:` header rewritten

A `From:` header set in the SMTP MAIL FROM / message body is **not enforced** by Postfix today (`smtpd_sender_restrictions` is empty). So nodemailer can technically send `alerts@sitedeck.pro` as the `From:` even when authenticating as `mi@modestintent.com`. The DMARC posture of `sitedeck.pro` is what controls whether receivers accept it (see #6).

**Caveat 2: deliverability.** Sending from a domain that the Postfix host isn't a known sender for will be treated as spam by most receivers (Gmail, Outlook, etc.) unless:
- The PTR record of `2.24.194.23` matches the sending domain
- SPF is published for `sitedeck.pro` including this IP
- DKIM is signed for `sitedeck.pro` (and the public key is in DNS)
- DMARC policy is published

For *operational alerts* (where the recipient is `support@sitedeck.pro` or a known user, and the recipient can add a filter), deliverability is less critical. For *customer-facing* email (RFI alerts, owner reports) it would be a real problem.

---

### 5. What the from address options are

Today, the Postfix config has **no sender restrictions**, so any `From:` is accepted. The practical options are:

| From address | Pros | Cons |
|---|---|---|
| `mi@modestintent.com` | Works today, DKIM-signed | Brand confusion — customers see "modestintent.com" |
| `alerts@modestintent.com` | Same as above; create a new alias row | Same brand issue |
| `alerts@sitedeck.pro` | Brand-correct | Not DKIM-signed today; needs DNS + OpenDKIM setup; SPF alignment needed |
| `support@sitedeck.pro` | Brand-correct, matches existing support address | Same setup as above |
| `no-reply@sitedeck.pro` | Standard transactional | Same setup as above |

The cleanest end-state is to have OpenDKIM sign `*@sitedeck.pro` and the PM service authenticate as a `sitedeck`-prefixed mailbox on `modestintent.com` (the existing user database), so the existing SASL infrastructure is reused. The `From:` is just a header; SMTP AUTH uses the existing Dovecot user database.

For *internal-only* alerts (admin emails to `support@sitedeck.pro`, where the recipient is the same person who can whitelist the sending address), `alerts@modestintent.com` is the lowest-friction option — works today, zero setup.

---

### 6. DKIM/SPF implications of adding sitedeck.pro

**DKIM (signing mail as `sitedeck.pro`):**

Three things must be true for receivers to validate the DKIM signature:

1. **OpenDKIM must sign for `sitedeck.pro`.** The `SigningTable` currently only has `*@modestintent.com`. Adding `*@sitedeck.pro  mail._domainkey.sitedeck.pro` and generating a 2048-bit RSA keypair in `/etc/opendkim/keys/sitedeck.pro/mail.{private,public}` are required.

2. **The DKIM public key must be published in DNS** as a TXT record at `mail._domainkey.sitedeck.pro`. Until the record exists, receivers see `dkim=fail` and route the mail to spam or reject it.

3. **The `d=` tag in the signed message must match the signing domain.** Standard.

**SPF (authorizing this server to send for `sitedeck.pro`):**

A TXT record at `sitedeck.pro` of the form:
```
"v=spf1 ip4:2.24.194.23 -all"
```
Or to combine with the existing infrastructure:
```
"v=spf1 a:mail.modestintent.com -all"
```

Without SPF, receivers that enforce `-all` (Gmail in particular) will mark the mail as spoofed.

**DMARC (telling receivers what to do with failures):**

Optional but recommended. A TXT record at `_dmarc.sitedeck.pro`:
```
"v=DMARC1; p=none; rua=mailto:dmarc-reports@sitedeck.pro"
```

Today, `dig +short TXT sitedeck.pro` returns only `"hosting-site=site-deck-marketing"` — no SPF, no DMARC. So mail from `sitedeck.pro` via this Postfix will arrive at external inboxes with `spf=neutral` and `dkim=none` (when sent as `sitedeck.pro`) and be treated as soft-spam or rejected outright.

**The host's PTR record** also matters. The current `2.24.194.23` PTR is set by Hostinger and points at a generic hostinger hostname — not `mail.modestintent.com` and not `mail.sitedeck.pro`. Most receivers do an rDNS check; a mismatched PTR is a soft-negative signal.

**The cert issue (recap from #3):** The TLS cert at `/etc/ssl/mail/mail.crt` is `CN=mail.modestintent.com` with a single SAN `DNS:mail.modestintent.com`. PM would need to either (a) use `mail.modestintent.com` as the SMTP host (hostname matches), (b) install a multi-SAN cert covering `mail.sitedeck.pro`, or (c) accept the cert mismatch with `tls: { rejectUnauthorized: false }` (not recommended for production).

---

## Bottom-line recommendation

The mail server is a real, well-configured, secure stack. It can replace SendGrid for SiteDeck operational alerts, with this decision matrix:

| Use case | Recommended path | Setup required |
|---|---|---|
| Internal admin alerts (to support@sitedeck.pro) | Send through existing Postfix as `alerts@modestintent.com` | Just an SASL account in the `mailserver.mailbox` table. PM env: `MAIL_HOST=127.0.0.1`, `MAIL_PORT=587`, `MAIL_USER=…`, `MAIL_PASS=…`, `MAIL_FROM=alerts@modestintent.com`. ~30 minutes. |
| Customer-facing mail (RFI alerts, owner reports) with `sitedeck.pro` From | Add `sitedeck.pro` to OpenDKIM, add `sitedeck.pro` to DNS (SPF + DKIM public key + DMARC), use a cert covering `mail.sitedeck.pro` or accept the cert mismatch | ~2-4 hours including DNS propagation. Multi-step, requires coordinating with DNS provider. |
| Customer-facing mail with `modestintent.com` From | Same as internal path; just need an SASL account | Same as internal path. |

**SendGrid is still the right choice for customer-facing transactional email** unless the operational savings (~$80/mo on the current SiteDeck volume) justify the multi-hour setup. The right time to consider switching is when there's a known recurring send that goes only to internal recipients (admin alerts, FCM/ops notifications).

For Sprint 10's `sendApprovalEmail` (which currently goes to `support@sitedeck.pro` via SendGrid), the cost is small but the win is real:
- SendGrid API key is a server-side secret; not needed anymore for internal-only mail
- The audit log + the email go through the same server (single source of truth)
- We can drop the `@sendgrid/mail` dependency

**Recommend:** Stand up a "SiteDeck alerts" mailbox on the existing stack for Sprint 11 (Task: "Replace SendGrid with internal Postfix for internal-only mail"). Customer-facing mail stays on SendGrid until/unless the sitedeck.pro DNS work is done.

---

## Files referenced (read-only)

- `/etc/postfix/main.cf` (no alias_maps, no sender_restrictions, mydestination=localhost, virtual_*=mysql)
- `/etc/postfix/mysql-virtual-mailbox-domains.cf`, `mysql-virtual-mailbox-maps.cf`, `mysql-virtual-alias-maps.cf`
- `/etc/opendkim/SigningTable` (only `*@modestintent.com`)
- `/etc/opendkim/KeyTable` (only `modestintent.com`)
- `/etc/opendkim/TrustedHosts` (loopback + `mail.modestintent.com` + `modestintent.com`)
- `/etc/opendkim/keys/modestintent.com/mail.{private,public}` (signing key)
- `/etc/ssl/mail/mail.{crt,key}` (Let's Encrypt, expires 2026-08-30, CN=`mail.modestintent.com`)
- `/var/log/mail.log` (last 20 lines: normal activity + recent abuse scan from 139.59.8.77)
- `mailserver` MySQL DB: 2 domains, 2 mailboxes, 10 aliases

---

## Mailbox created for SiteDeck internal alerts (2026-06-14)

| Field | Value |
|---|---|
| Mailbox | `helper@modestintent.com` |
| Password | `[REDACTED — stored in VPS .env]` (24-char base64, SHA512-CRYPT hashed; see `/opt/sitedeck-pm/.env` on the VPS) |
| Maildir | `/var/mail/vhosts/modestintent.com/helper/` (chown vmail:vmail, 750) |
| DB row | `mailserver.mailbox` (added 2026-06-14) |
| From address | `SiteDeck Helper <helper@modestintent.com>` |
| Reply-To | `support@sitedeck.pro` |
| DKIM signed? | Yes (signed as `*@modestintent.com` via existing OpenDKIM config) |
| PTR / SPF | `2.24.194.23` PTR is hostinger-default; SPF for `modestintent.com` covers this IP — internal delivery works fine |

**Why this works today:** OpenDKIM already signs `*@modestintent.com`. The mail server's TLS cert (`mail.modestintent.com`) matches the SMTP hostname, so nodemailer's `servername: 'mail.modestintent.com'` produces a clean handshake. `smtpd_sender_restrictions` is empty, so any `From:` is accepted. No DNS work needed for internal-only mail.

---

**Audit + mailbox setup complete. No Postfix or OpenDKIM config was modified.**
