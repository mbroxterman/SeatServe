import type { SeatServeData } from "../types/domain";

const today = new Date();
const at = (hour: number, minute = 0) => {
  const value = new Date(today);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

export const seedData: SeatServeData = {
  archivedOrders: [],
  archivedFeedback: [],
  events: [
    {
      id: "event-home-opener",
      name: "Varsity Football",
      opponent: "De Soto Wildcats",
      venueId: "venue-stadium",
      menuId: "menu-varsity-football",
      startsAt: at(19),
      orderingOpensAt: at(18, 15),
      orderingClosesAt: at(21, 30),
      status: "live",
      orderingEnabled: true,
    },
  ],
  venues: [
    {
      id: "venue-stadium",
      name: "Jaguar Stadium",
      type: "Outdoor Stadium",
      address: "5900 Monticello Road, Shawnee, KS",
      active: true,
      zones: [
        {
          id: "zone-home-west",
          name: "Home West",
          description: "West half of the home grandstand",
          deliveryEnabled: true,
          active: true,
          baselineRoundTripMinutes: 12,
          completedTripCount: 0,
          sections: [
            { id: "section-hw-101", name: "Section 101", seatRange: "Rows A-J, Seats 1-24", active: true },
            { id: "section-hw-102", name: "Section 102", seatRange: "Rows A-J, Seats 1-24", active: true },
          ],
        },
        {
          id: "zone-home-east",
          name: "Home East",
          description: "East half of the home grandstand",
          deliveryEnabled: true,
          active: true,
          baselineRoundTripMinutes: 9,
          completedTripCount: 0,
          sections: [
            { id: "section-he-103", name: "Section 103", seatRange: "Rows A-J, Seats 1-24", active: true },
            { id: "section-he-104", name: "Section 104", seatRange: "Rows A-J, Seats 1-24", active: true },
          ],
        },
        {
          id: "zone-visitors",
          name: "Visitor Side",
          description: "Visitor grandstand seating",
          deliveryEnabled: true,
          active: true,
          baselineRoundTripMinutes: 7,
          completedTripCount: 0,
          sections: [
            { id: "section-v-201", name: "Section 201", seatRange: "Rows A-H, Seats 1-20", active: true },
          ],
        },
        {
          id: "zone-premium",
          name: "Premium & Press",
          description: "Press box and reserved premium seating",
          deliveryEnabled: false,
          active: true,
          baselineRoundTripMinutes: 5,
          completedTripCount: 0,
          sections: [
            { id: "section-p-301", name: "Premium 301", seatRange: "Suites 1-8", active: true },
          ],
        },
      ],
    },
    {
      id: "venue-gym",
      name: "Main Gym",
      type: "Indoor Gym",
      address: "5900 Monticello Road, Shawnee, KS",
      active: true,
      zones: [
        {
          id: "zone-gym-north",
          name: "North Bleachers",
          description: "North side home seating",
          deliveryEnabled: true,
          active: true,
          baselineRoundTripMinutes: 6,
          completedTripCount: 0,
          sections: [
            { id: "section-gn-1", name: "North A", seatRange: "Rows 1-12", active: true },
          ],
        },
        {
          id: "zone-gym-south",
          name: "South Bleachers",
          description: "South side visitor seating",
          deliveryEnabled: true,
          active: true,
          baselineRoundTripMinutes: 5,
          completedTripCount: 0,
          sections: [
            { id: "section-gs-1", name: "South A", seatRange: "Rows 1-12", active: true },
          ],
        },
      ],
    },
  ],
  runners: [
    { id: "runner-1", name: "Alex Carter", email: "alex@example.com", phone: "555-0101", role: "lead", status: "available", active: true, availableSince: at(17, 30), venueId: "venue-stadium", zoneIds: ["zone-home-west"], completedDeliveries: 14, rating: 4.9 },
    { id: "runner-2", name: "Jordan Lee", email: "jordan@example.com", phone: "555-0102", role: "runner", status: "available", active: true, availableSince: at(17, 30), venueId: "venue-stadium", zoneIds: ["zone-home-east"], completedDeliveries: 9, rating: 4.8 },
    { id: "runner-3", name: "Taylor Morgan", email: "taylor@example.com", phone: "555-0103", role: "runner", status: "offline", active: true, venueId: "venue-stadium", zoneIds: [], completedDeliveries: 6, rating: 4.7 },
  ],
  menuCategories: [
    { id: "cat-entrees", name: "Entrées", visible: true, sortOrder: 1 },
    { id: "cat-drinks", name: "Drinks", visible: true, sortOrder: 2 },
    { id: "cat-snacks", name: "Snacks", visible: true, sortOrder: 3 },
    { id: "cat-candy", name: "Candy", visible: true, sortOrder: 4 },
  ],
  menus: [
    { id: "menu-varsity-football", name: "Varsity Football Menu", description: "Full Friday night concession menu", active: true, itemIds: ["menu-1", "menu-4", "menu-2", "menu-5", "menu-3", "menu-6", "menu-7", "menu-8", "menu-9"], priceOverrides: {}, hiddenItemIds: [] },
    { id: "menu-subvarsity-football", name: "Sub-Varsity Football Menu", description: "Reduced menu for JV and freshman football", active: true, itemIds: ["menu-4", "menu-2", "menu-5", "menu-3", "menu-6", "menu-7", "menu-8"], priceOverrides: {}, hiddenItemIds: [] },
    { id: "menu-basketball", name: "Basketball Menu", description: "Indoor gym concession menu", active: true, itemIds: ["menu-4", "menu-2", "menu-5", "menu-3", "menu-6", "menu-7", "menu-8", "menu-9"], priceOverrides: {}, hiddenItemIds: [] },
  ],
  menuItems: [
    { id: "menu-1", name: "Cheeseburger", category: "Entrées", categoryId: "cat-entrees", emoji: "🍔", description: "Quarter-pound burger with American cheese.", price: 6.5, available: true, kind: "standard", condiments: ["Ketchup", "Mustard", "Mayonnaise", "Pickles", "Onions"] },
    { id: "menu-4", name: "Hot Dog", category: "Entrées", categoryId: "cat-entrees", emoji: "🍔", description: "Classic stadium hot dog.", price: 4.75, available: true, kind: "standard", condiments: ["Ketchup", "Mustard", "Relish", "Onions"] },
    { id: "menu-2", name: "Nachos", category: "Snacks", categoryId: "cat-snacks", emoji: "🍿", description: "Warm tortilla chips with cheese sauce.", price: 4.5, available: true, kind: "quick-add" },
    { id: "menu-5", name: "Popcorn", category: "Snacks", categoryId: "cat-snacks", emoji: "🍿", description: "Fresh-popped and lightly salted.", price: 3.5, available: true, kind: "quick-add" },
    { id: "menu-3", name: "Bottled Water", category: "Drinks", categoryId: "cat-drinks", emoji: "🥤", description: "Cold 20 oz bottled water.", price: 2, available: true, kind: "quick-add" },
    { id: "menu-6", name: "Coke", category: "Drinks", categoryId: "cat-drinks", emoji: "🥤", description: "20 oz fountain drink.", price: 3, available: true, kind: "quick-add" },
    { id: "menu-7", name: "Diet Coke", category: "Drinks", categoryId: "cat-drinks", emoji: "🥤", description: "20 oz fountain drink.", price: 3, available: true, kind: "quick-add" },
    { id: "menu-8", name: "Sprite", category: "Drinks", categoryId: "cat-drinks", emoji: "🥤", description: "20 oz fountain drink.", price: 3, available: true, kind: "quick-add" },
    { id: "menu-9", name: "Sports Drink", category: "Drinks", categoryId: "cat-drinks", emoji: "🥤", description: "Chilled 20 oz bottle.", price: 4, available: true, kind: "quick-add" },
  ],
  orders: [
    {
      id: "SS-1042", eventId: "event-home-opener", items: [
        { menuItemId: "menu-1", name: "Cheeseburger", unitPrice: 6.5, quantity: 2 },
        { menuItemId: "menu-3", name: "Bottled Water", unitPrice: 2, quantity: 1 },
      ], customer: { name: "Morgan Reed", mobile: "555-0142" },
      location: { venueId: "venue-stadium", zoneId: "zone-home-west", vertical: "middle", horizontal: "right", notes: "Blue jacket near aisle" },
      subtotal: 15, tax: 1.35, deliveryFee: 2.5, total: 18.85, status: "new", placedAt: at(18, 42),
    },
    {
      id: "SS-1038", eventId: "event-home-opener", items: [
        { menuItemId: "menu-2", name: "Nachos", unitPrice: 4.5, quantity: 1 },
        { menuItemId: "menu-6", name: "Fountain Soda", unitPrice: 3, quantity: 2 },
      ], customer: { name: "Casey Hall", mobile: "555-0138" },
      location: { venueId: "venue-stadium", zoneId: "zone-home-east", vertical: "top", horizontal: "center" },
      subtotal: 10.5, tax: .95, deliveryFee: 2.5, total: 13.95, status: "preparing", placedAt: at(18, 35),
    },
    {
      id: "SS-1034", eventId: "event-home-opener", items: [
        { menuItemId: "menu-4", name: "Hot Dog", unitPrice: 4.75, quantity: 2 },
        { menuItemId: "menu-5", name: "Popcorn", unitPrice: 3.5, quantity: 1 },
      ], customer: { name: "Jamie Brooks", mobile: "555-0134" },
      location: { venueId: "venue-stadium", zoneId: "zone-visitors", vertical: "bottom", horizontal: "left" },
      subtotal: 13, tax: 1.17, deliveryFee: 2.5, total: 16.67, status: "ready", placedAt: at(18, 28),
    },
  ],
  activity: [
    { id: "activity-1", message: "SeatServe workspace initialized", occurredAt: new Date().toISOString(), tone: "success" },
  ],
  customerExperience: {
    headline: "Thank You for using SeatServe!",
    message: "We hope you enjoyed your order.",
    schoolMessage: "Thank you for supporting Mill Valley High School Athletics. Go Jaguars!",
    ratingPrompt: "How was your experience?",
    commentsPrompt: "Optional comments",
    supportTitle: "Support Mill Valley Athletics",
    finishLabel: "Finish",
    showRating: true,
    showComments: true,
    mascotSymbol: "🐾",
    primaryColor: "#071b38",
    secondaryColor: "#c7ced8",
    deliveryFee: 2,
    taxRatePercent: 9.1,
    estimatedCardFeePercent: 2.9,
    estimatedCardFeeFixed: 0.3,
    cashPaymentsEnabled: true,
    cardPaymentsEnabled: true,
    pickupEnabled: true,
    pickupLocationName: "Home Concession Stand",
    pickupInstructions: "Pick up at the concession window. Show your order number to the volunteer.",
    supportLinks: [
      { id: "support-donate", label: "Donate", url: "https://mvjagsboosterclub.boosterhub.com/home/11008", icon: "💚", enabled: true },
      { id: "support-volunteer", label: "Volunteer", url: "https://mvjagsboosterclub.boosterhub.com/home/11008", icon: "🙋", enabled: true },
      { id: "support-sponsor", label: "Become a Sponsor", url: "https://mvjagsboosterclub.boosterhub.com/home/11008", icon: "🤝", enabled: true },
    ],
  },
  staffAccess: {},
  feedback: [],
};
