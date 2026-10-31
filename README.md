# Stacks – Library Management System (MERN)

A college-library system where **students** sign up, borrow, renew and reserve books, and the **librarian** runs the collection.

## 1. Set up
Needs Node 18+ and MongoDB running locally (or put a MongoDB Atlas URI in `MONGO_URI`).

Open `server/.env` and set:
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the librarian login. It is stored in this file, not in the database. **Change the defaults.**
- `JWT_SECRET`: any long random text.

```bash
npm run setup   # installs root, server and client dependencies
npm run dev     # API on :5000, app on http://localhost:5173
```
Twelve sample books are added the first time the server starts. There are no demo students: every student signs up on the login page.

## 2. Password reset by email
Students click **Forgot password?**, enter their email and get a link. The link opens a page where they choose a new password, which is saved (hashed) in MongoDB. The link works once and expires after 1 hour.

To send real emails, fill in the SMTP settings in `server/.env`. For Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, and `SMTP_PASS` = a Google **App Password** (needs 2-step verification on). If `SMTP_HOST` is empty, the reset link is printed in the server terminal instead, which is handy while testing.

The librarian password is changed by editing `server/.env` and restarting the server.

## Login
- **Remember me** (ticked by default) keeps a student signed in for 30 days. Unticked, the login lasts until the browser tab closes. Browsers can also save the email and password because the form is set up for it.

## Rules built in
- Max **3 books** at a time, **14-day** loans, **one 7-day renewal** (not for overdue books or books others are waiting for).
- Fine of **₹5 per day** overdue. Students with overdue books or unpaid fines cannot borrow.
- If every copy is out, students **reserve** the book. The next returned copy is held for the first student in the queue.
- Librarian: dashboard, add/edit/delete books, issue and return books, mark fines paid, block or unblock students.

Change the rules at the top of `server/server.js` (`LIMIT`, `DAYS`, `RATE`).

## Devices
The layout adapts to phones, tablets, laptops and large screens: bottom tab bar and bottom-sheet dialogs on phones, card view for the student list, and a show/hide eye icon on every password box.
