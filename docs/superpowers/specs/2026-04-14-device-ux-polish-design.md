# Device UX Polish — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Problem

The device management system is functional but missing key UX features: scan results don't show game counts, devices can't be edited after creation, and there's no concept of an "active device" for uploads and quick switching.

## Solution

Three improvements: detailed scan result messages, device edit functionality, and a global active device setting with header dropdown.

---

## 1. Scan Result with Numbers

### Current
Scan button on `/devices` shows "Scan completed successfully" with no detail.

### Change
Display: "Found {total} games ({new} new, {updated} updated)" using the values already returned by `POST /api/devices/[id]/scan`.

On error: red text with the error message.

Single line directly below the Scan Device button, same as current placement.

### Files
- Modify: `src/app/devices/page.tsx` — update scan result display to use total/new/updated from response

---

## 2. Device Editing

### Current
Admin Settings device list only has a Delete button per device. No way to edit.

### Change
Add "Edit" button per device in the Admin Settings device list. Clicking opens the existing `<DeviceForm>` component pre-filled with the device's current values.

- Name, type, protocol, host, port, user are pre-filled from the device data
- Password field shows empty with placeholder "unchanged" (don't send masked value back)
- "Test Connection" button works as usual
- Save makes `PUT /api/devices/[id]`
- Cancel collapses back to the device list

Only one form open at a time — editing a device hides the "Add Device" form and vice versa.

### Files
- Modify: `src/app/admin/page.tsx` — add Edit button, editingDeviceId state, render DeviceForm with initial values
- Modify: `src/app/api/devices/[id]/route.ts` — GET endpoint must return unmasked data for edit (or add a separate query param `?edit=true`)

### API Note
The GET `/api/devices/[id]` currently masks the password. For editing, the frontend doesn't need the password — the form shows an empty password field and only sends the password in PUT if the user typed a new one. No API change needed.

---

## 3. Global Active Device

### Data Model

Add to Settings:
```prisma
activeDeviceId Int?
```

### API Changes

- `GET /api/settings` — include `activeDeviceId` in response
- `PUT /api/settings` — accept `activeDeviceId` in body
- When the active device is deleted, `activeDeviceId` is set to null

### Admin Settings

"Default Device" dropdown in the Devices section, below the device list. Options: all devices + "None". Saved as part of the normal settings save flow.

### Header

Small device selector dropdown at the right end of the header nav. Shows the active device name (or "No device" if none selected). Changing it immediately PUTs to `/api/settings` to update `activeDeviceId`.

Styling: subtle, matches existing nav style. Not a full-width select — compact dropdown.

### Integration Points

- **Devices page** (`/devices`): auto-selects the active device in the device dropdown on load
- **Upload** (`/admin/upload`): uses the active device's connection for file transfer
- **Scan** (`/api/scan`): no change (still scans all devices)

### Files
- Modify: `prisma/schema.prisma` — add `activeDeviceId` to Settings
- Modify: `src/app/api/settings/route.ts` — handle activeDeviceId in GET/PUT
- Modify: `src/components/layout/header.tsx` — add device selector dropdown
- Modify: `src/app/admin/page.tsx` — add Default Device dropdown in Devices section
- Modify: `src/app/devices/page.tsx` — auto-select active device on load
- Modify: `src/app/api/devices/[id]/route.ts` — on DELETE, clear activeDeviceId if it matches

---

## Key Files Summary

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `activeDeviceId Int?` to Settings |
| `src/app/devices/page.tsx` | Scan result display, auto-select active device |
| `src/app/admin/page.tsx` | Edit button, DeviceForm for editing, Default Device dropdown |
| `src/components/layout/header.tsx` | Active device selector dropdown |
| `src/app/api/settings/route.ts` | Handle activeDeviceId |
| `src/app/api/devices/[id]/route.ts` | Clear activeDeviceId on device delete |
