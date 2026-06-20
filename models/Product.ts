import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProductRecipeLine {
  inventoryItemId: mongoose.Types.ObjectId;
  /** Units of the inventory item consumed per one unit of this product sold. */
  quantity: number;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  category: string;
  businessId: mongoose.Types.ObjectId;
  isAvailable: boolean;
  sortOrder: number;
  /** Optional link to inventory: what gets deducted when one unit sells.
   *  Items with no recipe don't touch inventory at all. */
  recipe?: IProductRecipeLine[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductRecipeLineSchema = new Schema<IProductRecipeLine>(
  {
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, default: 'General' },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    recipe: { type: [ProductRecipeLineSchema], default: undefined },
  },
  { timestamps: true }
);

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
