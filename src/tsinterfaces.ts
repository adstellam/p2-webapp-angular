export interface User {
    uid: string;
    oid: string;
    role: string;
    pwd: string;
    lastName?: string;
    firstName?: string;
    email?: string;
    phone?: string;
    createdAt: Date;
    editedBy?: string;
    active?: boolean;
}

export interface Customer {
    oid: string;
    name?: string;
    city?: string;
    state?: string;
    createdAt: Date;
    editedBy?: string;
    active?: boolean;
}

export interface Cultivator {
    cid: string;
    oid: string;
    model: string;
    lanes: number;
    ipAddress: string;
    createdAt: Date;
    editedBy?: string;
    active?: boolean;
}
