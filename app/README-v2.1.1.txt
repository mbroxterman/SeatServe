SeatServe v2.1.1 - Google Sheets Structured Sync

Pilot reliability patch only. No architecture changes.

Google Sheets now keeps the lossless SeatServe Data JSON backup while also writing human-readable tabs for Events, Venues, Zones, Venue Sections, Menu Categories, Menu Items, Menus, Runners, Orders, Customer Feedback, Workspace Settings, Community Support, and Activity.

Load from Sheets reads the structured tabs first, so edits made directly in those tabs can be loaded back into SeatServe. A simple onEdit trigger updates SeatServe Meta so the existing conflict protection can detect remote edits.

The included Code.gs is configured for the current SeatServe - Dev spreadsheet ID supplied for this workspace.
