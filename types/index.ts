export enum UserRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  STAFF = "STAFF",
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  branding: {
    logo?: string;
    primaryColor: string;
  };
  settings: {
    requiredVisits: number;
    rewardDescription: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  businessId: string;
  stats: {
    totalVisits: number;
    currentVisits: number;
    points: number;
  };
  externalIds: {
    applePassId?: string;
    googlePassId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Visit {
  id: string;
  customerId: string;
  businessId: string;
  employeeId: string;
  type: "VISIT" | "REWARD_REDEMPTION";
  timestamp: Date;
}
