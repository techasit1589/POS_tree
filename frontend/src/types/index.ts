export interface Tree {
  id: number;
  name: string;
  nameLatin?: string;
  category?: string;
  price: number;
  unit?: string;
  description?: string;
}

export interface CartItem {
  id: string; // local uuid for cart management
  treeId?: number;
  treeName: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
}

export interface OrderItem {
  id: number;
  treeName: string;
  treeId?: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  receiptNumber: string;
  totalAmount: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentMethod?: 'cash' | 'transfer';
  status: string;
  items: OrderItem[];
  createdAt: string;
}
