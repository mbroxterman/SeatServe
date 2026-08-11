Data Model

Project: SeatServe

Version: 1.0

Status: Draft

Last Updated: 2026-08-04

Purpose

This document defines every major object used by SeatServe and the relationships between those objects.

The Data Model serves as the foundation for:

Local Storage
Future Google Drive integration
Reporting
Analytics
Future payment integrations
Future APIs
Data Categories

SeatServe separates information into two categories.

Configuration Data

Configuration data changes infrequently.

Examples:

Menus
Menu Items
Venues
Zones
Runner List
Settings
Event Templates
Delivery Fees

Configuration belongs to the Workspace.

Operational Data

Operational data changes continuously.

Examples:

Orders
Runner Status
Kitchen Status
Customer Ratings
Analytics
Reports

Operational data is generated during events.

Workspace

Represents one organization.

Examples:

Development
Mill Valley High School Booster Club

Contains:

Venues
Menus
Events
Reports
Settings
Runners

Relationships

Workspace

↓

Many Venues

↓

Many Menus

↓

Many Events

Venue

Represents a physical location.

Examples

Football Stadium & Track Complex
Soccer Field
Baseball Field
Softball Field
Main Gym
Aux Gym

Properties

Name
Sports
Pickup Locations
Active
Zones

Relationships

Venue

↓

Many Zones

↓

Many Events

Zone

Represents a delivery area.

Examples

Home Lower Bleachers
Visitor Upper
West Bleachers

Properties

Venue
Name
QR Code
Active

Relationships

Zone

↓

Many Orders

Menu

Represents a collection of menu items.

Examples

Football Menu
Basketball Menu
Track Menu

Properties

Name
Description
Active

Relationships

Menu

↓

Many Menu Items

↓

Many Venues

Menu Item

Represents one concession item.

Examples

Hot Dog
Hamburger
Nachos
Drinks

Properties

Name
Description
Thumbnail
Base Price
Category
Availability
Assigned Menus

Relationships

Menu Item

↓

Many Modifier Groups

Modifier Group

Represents options for a menu item.

Examples

Condiments

Drink Selection

Cheese

Properties

Name
Required
Multi Select

Relationships

Modifier Group

↓

Many Modifier Options

Modifier Option

Examples

Ketchup

Mustard

Pepsi

Water

Properties

Name
Price Adjustment
Active
Event

Represents one athletic event.

Examples

Football

Basketball

Soccer

Properties

Venue
Event Name
Event Date
Active Menu
Delivery Enabled
Pickup Enabled
Pickup Location
Delivery Fee
Ordering Status

Relationships

Event

↓

Many Orders

↓

Many Runners

Runner

Represents one delivery runner.

Properties

Name
Status
Current Order
Completed Deliveries

Status Values

Available
Delivering
Break
Offline

Relationships

Runner

↓

Many Orders

Order

Represents one customer purchase.

Properties

Order Number
Customer Name
Phone
Venue
Zone
Location
Delivery Method
Payment Method
Items
Runner
Status
SeatBeacon
Rating

Relationships

Order

↓

Many Order Items

Order Item

Represents one purchased item.

Properties

Menu Item
Quantity
Unit Price
Modifiers
SeatBeacon

Represents the customer visibility feature.

Properties

Mode
Active
Start Time
End Time

Modes

Flash Screen
Wave Phone
Report

Represents generated reporting.

Examples

Sales

Runner

Venue

Analytics

Customer Feedback

Properties

Report Type
Date
Event
Generated Time
Analytics

Generated from operational data.

Pilot Metrics

Total Orders
Gross Sales
Average Delivery Time
Average Wait Time
Runner Performance
Sales by Venue
Menu Performance
Delivery Fee Totals
Pickup vs Seat Delivery
Customer Rating
Storage Providers

Current

Local Storage

Future

Google Drive
BoosterHub
Other Providers

Storage providers must support the same data model without requiring application changes.

Entity Relationships

Workspace

├── Venues

│ └── Zones

├── Menus

│ └── Menu Items

│ └── Modifier Groups

│ └── Modifier Options

├── Events

│ └── Orders

│ └── Runners

│ └── Reports

Guiding Principles
Configuration data is separate from operational data.
Orders never contain configuration.
Configuration is owned by the Workspace.
Every object has a unique identifier.
Storage providers are interchangeable.
Reports are generated from operational data rather than stored manually.
Revision History
Version	Date	Description
1.0	2026-08-04	Initial Data Model
