# meanwhile

Meet someone while you code. Type `/meanwhile` (or `/mw` for short) in Claude Code, get matched with someone who's here right now, and chat in the side panel without leaving your work.

https://meanwhile.gripe

## Install

In Claude Code, run these one after the other:

```
/plugin marketplace add radioheavy/meanwhile
/plugin install meanwhile@meanwhile
```

Then `/reload-plugins` (or restart Claude Code) and type `/mw`.

For new versions to arrive on their own: `/plugin` → Marketplaces → meanwhile → Enable auto-update.

In the desktop app: + next to the prompt box → Plugins → Add marketplace → `radioheavy/meanwhile` → Add plugin.

### One line instead

This script runs the same two plugin commands and turns on auto-update. Paste it into Claude Code (the `!` runs it right there), or into your terminal without the `!`:

```
! curl -fsSL https://meanwhile.gripe/kur.sh | sh
```

It's about 40 lines; read it first if you like: https://meanwhile.gripe/kur.sh

## Updating

With auto-update on, new versions arrive when you restart Claude. Otherwise the panel tells you when one is out; update with `/plugin` → Marketplaces → meanwhile → Update, or run the one-line script again. Older versions keep working unless a release changes how the plugin talks to the server.

`/meanwhile version` shows which version you're on.

## Usage

```
/meanwhile                  open the panel and start meeting people
/meanwhile new              meet someone new while your chats continue
/meanwhile chats            back to the chat list
/meanwhile <message>        send a message to the open chat (you can also type in the panel)
/meanwhile end              end the open chat (deletes a connection)
/meanwhile block            never run into this person again
/meanwhile report [reason]  report someone who bothers you
/meanwhile blocked          see who you blocked, unblock if you like
/meanwhile leave            end your regular chats (connections stay)
/meanwhile version          your version and update status
/meanwhile support          buy us a coffee ☕
/meanwhile help             all commands
```

The first time, you're asked for a nickname, your gender, and who you'd like to meet. Others see your gender as a color (pink for women, blue for men; a neutral color if you'd rather not say). Who you're looking for is never shown; it's only used for matching. You can also add your field (Frontend, Backend…) and what you're up to right now (Waiting on a deploy, Night owl…); the other person sees these.

You can talk to several people at once: the panel has a chat list, each with its unread count and a "typing…" indicator. Press `ctrl+x tab` to switch to the panel.

**★ Stay connected:** If both of you want it, the chat is kept. It survives closing and reopening Claude, and messages you send while the other person is offline wait for them. If either of you deletes the connection, it's deleted along with its messages.

## Photos

Photos can only be sent to people you've **★ stayed connected** with, and **the other person's permission** is asked first ("📷 Aslı wants to send you photos. Accept?"). If you say no, you won't get photos from them in that chat; you can turn them on any time with "Allow photos". Below the chat list you can turn off receiving photos altogether.

When sending, you choose: **🔥 View once** (opens once, then it's deleted for everyone) or **📌 Keep in chat** (stays as long as you stay connected). Pick a file with **📁 Browse…** (your system's file picker) or send what you copied with **📋 Paste from clipboard**: a screenshot, a copied image, or an image file copied in your file manager. Photos are resized before they're sent, and details like location are removed (needs ffmpeg, ImageMagick, or sips on macOS; on Linux, xclip or wl-clipboard for the clipboard and zenity or kdialog for Browse).

**Disclaimer:**
- You alone are responsible for the photos you send.
- Nudity or sexual content, images that belong to someone else or were taken without consent, and any image showing anyone under 18 are not allowed. Reported photos are reviewed; breaking the rules means losing access and, when needed, a report to the authorities.
- A view-once photo is deleted after it's opened, but the other person could still take a screenshot; meanwhile can't prevent that.

## Privacy and safety

- No real name, email or photo is asked for; only your nickname is shown.
- Regular chats live in the server's memory and are deleted when they end. Messages in connections that both of you chose to keep are stored until one of you deletes the connection. The last messages of reported chats are kept for review.
- Notifications never show the message itself; if you type a phone number, email or link, you're warned before it's sent.
- **What the other person writes never reaches your Claude session.** Messages only show in the panel and in notifications; command output is marked so it's never sent to the model. Nobody can make your Claude do anything on your behalf.
- **Reports are reviewed with AI help.** When someone reports a chat, its latest messages are checked by an AI model (Claude, via our server) and by us. Other chats are never read.
- We collect usage data linked to a random ID, not to who you are: when you match, how many messages you send and how long they are, your gender and who you're looking for. Never what anyone writes, your nickname or your photos.
- You agree to these the first time you start (`/meanwhile terms` shows them again). Full text: https://meanwhile.gripe/terms · https://meanwhile.gripe/privacy
- For people 18 and older.

## Support

If meanwhile made a wait nicer, you can buy us a coffee: https://buymeacoffee.com/oktaydak (also in the panel and `/mw support`).

## Notes

This plugin uses Claude Code's new "mod" platform (commands, panel, notifications). That platform is in early access, so it may change with Claude Code updates.

Copyright © 2026 radioheavy. All rights reserved.
