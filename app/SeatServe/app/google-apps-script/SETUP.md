# SeatServe v1.6 Google Sheets setup

1. Create or open the private Google Sheet that will hold the SeatServe workspace.
2. Open **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with the included `google-apps-script/Code.gs` file.
4. Click **Deploy > New deployment** and choose **Web app**.
5. Execute as **Me** and grant access to the intended users.
6. Copy the web app URL ending in `/exec`.
7. In SeatServe, open **Administration > Settings**.
8. Enter the workspace name and Apps Script web app URL, then click **Connect workspace**.
9. Click **Sync now** to create the first remote copy.

SeatServe remembers the connection in this browser. On a different computer or browser, connect once using the same Apps Script URL and then choose **Load from Sheets**.

## Updating an existing deployment

After replacing `Code.gs`, use **Deploy > Manage deployments > Edit**, select a new version, and redeploy. The `/exec` URL normally remains the same.
