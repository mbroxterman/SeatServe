export type RunnerStatus = "offline" | "available" | "assigned" | "delivering" | "returning";
export type OrderStatus = "new" | "preparing" | "ready" | "assigned" | "delivering" | "delivered" | "cancelled";
export type FulfillmentMethod = "pickup" | "delivery-to-seat" | "delivery-to-zone";
export type PaymentMethod = "cash" | "card";

export interface VenueSection {
    id: string;
    name: string;
}

export interface DeliveryZone {
    id: string;
    name: string;
    description: string;
    active: boolean;
    deliveryEnabled: boolean;
    sections: VenueSection[];
    baselineRoundTripMinutes?: number;
    learnedRoundTripMinutes?: number;
    completedTripCount?: number;
}

export interface Venue {
    id: string;
    name: string;
    type: string;
    address: string;
    active: boolean;
    zones: DeliveryZone[];
}

export interface Runner {
    id: string;
    name: string;
    email: string;
    phone: string;
    active: boolean;
    role: "runner" | "lead";
    status: RunnerStatus;
    venueId?: string;
    zoneIds: string[];
    activeOrderId?: string;
    completedDeliveries: number;
    rating: number;
    assignedAt?: string;
    estimatedAvailableAt?: string;
    availableSince?: string;
}

export interface MenuCategory {
    id: string;
    name: string;
    emoji: string;
    imageUrl?: string;
    visible: boolean;
    sortOrder: number;
}

export interface MenuItem {
    id: string;
    categoryId: string;
    category: string;
    name: string;
    description: string;
    price: number;
    available: boolean;
    kind: "standard" | "quick-add";
    condiments: string[];
    emoji?: string;
    imageUrl?: string;
    imageAlt?: string;
    displayStyle?: "emoji" | "image" | "image-with-emoji-fallback";
}

export interface MenuDefinition {
    id: string;
    name: string;
    description: string;
    active: boolean;
    itemIds: string[];
    hiddenItemIds?: string[];
    priceOverrides?: Record<string, number>;
}

export interface SeatServeEvent {
    id: string;
    name: string;
    opponent?: string;
    startsAt: string;
    venueId: string;
    menuId?: string;
    status: "draft" | "scheduled" | "live" | "completed";
    orderingEnabled: boolean;
}

export interface OrderItem {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    selectedCondiments: string[];
}

export interface Order {
    id: string;
    eventId: string;
    fulfillmentMethod: FulfillmentMethod;
    paymentMethod: PaymentMethod;
    items: OrderItem[];
    customer: {
        name: string;
        mobile?: string;
    };
    location: {
        venueId: string;
        zoneId: string;
        vertical: string;
        horizontal: string;
    };
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    cashTotal?: number;
    estimatedCardFee?: number;
    cardTotal?: number;
    status: OrderStatus;
    runnerId?: string;
    placedAt: string;
    acceptedAt?: string;
    preparingAt?: string;
    readyAt?: string;
    assignedAt?: string;
    assignmentQueuedAt?: string;
    deliveringAt?: string;
    deliveredAt?: string;
    customerLocatedAt?: string;
    seatBeaconRequestedAt?: string;
    seatBeaconOpenedAt?: string;
    paymentCollectedAt?: string;
}

export interface ActivityItem {
    id: string;
    message: string;
    tone: "info" | "success" | "warning";
    occurredAt: string;
}

export interface SupportLink {
    id: string;
    label: string;
    icon: string;
    url: string;
    enabled: boolean;
}

export interface CustomerExperienceSettings {
    supportLinks: SupportLink[];
    deliveryFee: number;
    taxRatePercent: number;
    estimatedCardFeePercent: number;
    estimatedCardFeeFixed: number;
    cashPaymentsEnabled: boolean;
    cardPaymentsEnabled: boolean;
    pickupEnabled: boolean;
    pickupLocationName: string;
    pickupInstructions: string;
    minimumOrderAmount?: number;
}

export interface StaffAccessSettings {
    passcodeEnabled: boolean;
    passcodeHash?: string;
}

export interface CustomerFeedback {
    id: string;
    orderId: string;
    eventId: string;
    rating: number;
    comments: string;
    submittedAt: string;
}

export interface SeatServeData {
    events: SeatServeEvent[];
    venues: Venue[];
    runners: Runner[];
    menuItems: MenuItem[];
    menuCategories: MenuCategory[];
    menus: MenuDefinition[];
    orders: Order[];
    activity: ActivityItem[];
    customerExperience: CustomerExperienceSettings;
    staffAccess: StaffAccessSettings;
    feedback: CustomerFeedback[];
    archivedOrders?: Order[];
    archivedFeedback?: CustomerFeedback[];
}
