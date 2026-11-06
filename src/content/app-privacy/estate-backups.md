---
app: 'Estate Backups'
platforms: 'a private server backup tool'
effective: 2026-11-07
---

Estate Backups is an internal tool. It copies encrypted backups of our own servers into our own Google Drive. It is not offered to the public, and the only Google account it is ever connected to is ours.

## What it accesses

It asks Google for the narrowest Drive permission available (`drive.file`). That lets it see and manage only the files it created itself. It cannot read, list or change any other file in the Drive. It does not ask for email, contacts, calendar or any other Google data.

## What it stores

The files it writes are backups of our own databases and file storage. They are encrypted on our servers before they are uploaded, so Google stores only encrypted data that it cannot read. Nothing is sold or shared with anyone.

## Removing access

Access can be revoked at any time from the Google Account's security settings, under "Third-party apps with account access". Revoking it stops new backups from being written. Backups that already exist stay in Drive until they are deleted.

## This website

This page uses no cookies and no analytics. It loads its fonts from Google Fonts, so your browser contacts Google when it opens the page. Like any web server, our hosting and its network provider (Cloudflare) may keep short-lived technical logs, such as IP address, time and page requested, for security and to fix problems. We do not use them to identify you and do not share them.

## Changes

If the tool ever asks for broader access, this page will be updated first, and the date at the top changed.
