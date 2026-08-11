export type EventStatus = "draft" | "scheduled" | "live" | "completed" | "cancelled";
export type RunnerStatus = "available" | "assigned" | "returning" | "offline";
export type OrderStatus = "new" | "preparing" | "ready" | "assigned" | "delivering" | "delivered" | "cancelled";
export type VerticalLocation = "top" | "middle" | "bottom";
export type HorizontalLocation = "left" | "center" | "right";

export interface SeatServeEvent { id:string; name:string; opponent:string; venueId:string; menuId?:string; startsAt:string; orderingOpensAt:string; orderingClosesAt:string; status:EventStatus; orderingEnabled:boolean; }
export interface VenueSection { id:string; name:string; seatRange:string; active:boolean; }
export interface DeliveryZone { id:string; name:string; description:string; deliveryEnabled:boolean; active:boolean; sections:VenueSection[]; baselineRoundTripMinutes?:number; learnedRoundTripMinutes?:number; completedTripCount?:number; }
export interface Venue { id:string; name:string; type:string; address:string; active:boolean; zones:DeliveryZone[]; }
export interface Runner { id:string; name:string; email:string; phone:string; role:"runner"|"lead"; status:RunnerStatus; active:boolean; venueId:string; zoneIds:string[]; shiftStart:string; shiftEnd:string; completedDeliveries:number; rating:number; activeOrderId?:string; availableSince?:string; assignedAt?:string; estimatedAvailableAt?:string; }

export interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string;
  visible: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id:string;
  name:string;
  category:string;
  categoryId?:string;
  description?:string;
  price:number;
  available:boolean;
  kind?:"standard"|"quick-add";
  inventory?:number;
  condiments?:string[];
  emoji?:string;
  imageUrl?:string;
  imageAlt?:string;
  displayStyle?:"emoji"|"image"|"image-with-emoji-fallback";
}

export interface MenuDefinition {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  itemIds: string[];
  priceOverrides?: Record<string, number>;
  hiddenItemIds?: string[];
}

export interface OrderLineItem { menuItemId:string; name:string; unitPrice:number; quantity:number; condiments?:string[]; }
export interface OrderLocation { venueId:string; zoneId:string; vertical:VerticalLocation; horizontal:HorizontalLocation; notes?:string; }
export interface OrderCustomer { name:string; mobile?:string; }
export type PaymentMethod = "cash" | "card";
export interface Order { id:string; eventId:string; runnerId?:string; items:OrderLineItem[]; customer:OrderCustomer; location:OrderLocation; subtotal:number; tax:number; total:number; deliveryFee:number; paymentMethod?:PaymentMethod; cashTotal?:number; estimatedCardFee?:number; cardTotal?:number; paymentCollectedAt?:string; seatBeaconRequestedAt?:string; seatBeaconOpenedAt?:string; customerLocatedAt?:string; status:OrderStatus; placedAt:string; acceptedAt?:string; preparingAt?:string; readyAt?:string; assignedAt?:string; deliveringAt?:string; deliveredAt?:string; assignmentQueuedAt?:string; }
export interface ActivityItem { id:string; message:string; occurredAt:string; tone:"info"|"success"|"warning"; }

export interface CommunitySupportLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  enabled: boolean;
}

export interface CustomerExperienceSettings {
  headline: string;
  message: string;
  schoolMessage: string;
  ratingPrompt: string;
  commentsPrompt: string;
  supportTitle: string;
  finishLabel: string;
  showRating: boolean;
  showComments: boolean;
  mascotSymbol: string;
  primaryColor: string;
  secondaryColor: string;
  supportLinks: CommunitySupportLink[];
  deliveryFee: number;
  taxRatePercent: number;
  estimatedCardFeePercent: number;
  estimatedCardFeeFixed: number;
  cashPaymentsEnabled: boolean;
  cardPaymentsEnabled: boolean;
}

export interface StaffAccessSettings {
  adminPinHash?: string;
  kitchenPinHash?: string;
  runnerPinHash?: string;
}

export interface CustomerFeedback {
  id: string;
  orderId: string;
  eventId: string;
  rating?: number;
  comments?: string;
  submittedAt: string;
}

export interface SeatServeData { events:SeatServeEvent[]; venues:Venue[]; runners:Runner[]; menuCategories:MenuCategory[]; menuItems:MenuItem[]; menus:MenuDefinition[]; orders:Order[]; activity:ActivityItem[]; customerExperience:CustomerExperienceSettings; staffAccess:StaffAccessSettings; feedback:CustomerFeedback[]; }
