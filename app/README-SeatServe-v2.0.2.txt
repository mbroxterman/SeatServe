SeatServe v2.0.2 - Configurable Delivery Fee

Changes
- Adds a workspace-specific Delivery Fee field under Administration > Settings > Customer experience.
- Shows the delivery fee in the customer cart and checkout totals.
- Uses the configured fee when a new order is placed.
- Allows a fee of $0.00.
- Migrates existing workspaces to the prior $2.00 default without losing saved data.
- Includes the fee in workspace backups and Google Sheets synchronization because it is stored with customer experience settings.

Install
1. Stop npm run dev.
2. Replace the matching files with this package.
3. Run npm install if node_modules is not present.
4. Run npm run dev.
5. Open Administration > Settings and set Delivery fee.
