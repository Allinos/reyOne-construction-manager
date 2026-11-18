# reyOne Site — Flutter mobile app

Site-focused companion to the reyOne web app. It talks to the **same backend
and database** (your dedicated server) and only shows the modules that are
enabled for your company *and* allowed for the signed-in user's role.

## What it does

| Area | On the phone |
|---|---|
| Attendance | Daily sheet for employees and labour — big P / H / A / L buttons, site tag, "all present", save |
| Projects | Assigned projects with progress; tick tasks off (moves progress); raise and approve requests |
| Site Inspection | Start from checklist templates, Pass / Fail / N/A, camera photos, record & assign issues, close |
| My Issues | Issues assigned to you — start, mark resolved (inspector is notified to verify) |
| Materials | Raise material requests, approve/reject (approvers), record site consumption |
| Queries | Raise, assign, reply in a thread, attach photos, mark resolved |
| Notifications | In-app list (tap opens the related item) + push notifications when Firebase is set up |

## Activation (per company)

The app works only when **Settings → Modules → Mobile App** is enabled on that
company's server. Every request carries `X-Client: mobile`; if the module is
off, sign-in is refused with a clear message.

## Build

Requires Flutter 3.50+ (Dart 3.14+).

```bash
cd mobile
flutter pub get
flutter run                      # device / emulator
flutter build apk --release      # Android
flutter build ipa --release      # iOS (on macOS)
```

On first launch the user enters the company server address
(e.g. `erp.yourcompany.com`). Use **HTTPS** — Android and iOS block plain HTTP
by default.

## Push notifications (optional)

Without Firebase the app still works and shows notifications in-app.
To enable push:

1. Create a Firebase project, add an Android app (`com.reyone.reyone_mobile`)
   and/or iOS app; place `google-services.json` in `android/app/` and
   `GoogleService-Info.plist` in `ios/Runner/` (and apply the
   `com.google.gms.google-services` Gradle plugin per the FlutterFire docs).
2. On the server, create a Firebase service-account key and set **one** of:
   - `FCM_SERVICE_ACCOUNT=/path/to/service-account.json`
   - `FCM_SERVICE_ACCOUNT_JSON='{"project_id": ...}'`
3. Restart the API. Devices register their token after sign-in; every in-app
   notification (approvals, queries, issues, material requests, reminders) is
   also pushed to the user's phones.

## Structure

```
lib/core/      api client (token refresh, X-Client header), session (modules +
               permissions), theme, formatting, shared widgets, photos, push
lib/screens/   login, home, attendance, projects, inspections, materials,
               queries, notifications
```
