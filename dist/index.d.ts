import { z } from 'zod';

declare const PaprikaConfigSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    apiBaseUrl: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    retries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    apiBaseUrl: string;
    timeout: number;
    retries: number;
}, {
    email: string;
    password: string;
    apiBaseUrl?: string | undefined;
    timeout?: number | undefined;
    retries?: number | undefined;
}>;
type PaprikaConfig = z.infer<typeof PaprikaConfigSchema>;
declare function configFromEnv(): PaprikaConfig;
declare function configFromSops(secretsPath?: string): PaprikaConfig;
declare function resolveConfig(): PaprikaConfig;

interface AuthStrategy {
    getHeaders(): Promise<Record<string, string>>;
}

interface RequestOptions {
    method: 'GET' | 'POST';
    endpoint: string;
    apiVersion: 'v1' | 'v2';
    data?: unknown;
    files?: FileUpload[];
}
interface FileUpload {
    name: string;
    filename: string;
    contentType: string;
    data: Buffer;
}
declare class PaprikaHttpClient {
    private basicAuth;
    private jwtAuth;
    private apiBaseUrl;
    constructor(basicAuth: AuthStrategy, jwtAuth: AuthStrategy, apiBaseUrl?: string);
    request<T>(options: RequestOptions): Promise<T>;
    private parseResponse;
}

declare const RecipeSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    ingredients: z.ZodString;
    directions: z.ZodString;
    description: z.ZodString;
    notes: z.ZodString;
    nutritional_info: z.ZodString;
    servings: z.ZodString;
    prep_time: z.ZodString;
    cook_time: z.ZodString;
    total_time: z.ZodString;
    difficulty: z.ZodString;
    source: z.ZodString;
    source_url: z.ZodString;
    image_url: z.ZodNullable<z.ZodString>;
    photo: z.ZodNullable<z.ZodString>;
    photo_large: z.ZodNullable<z.ZodString>;
    photo_hash: z.ZodNullable<z.ZodString>;
    categories: z.ZodArray<z.ZodString, "many">;
    rating: z.ZodNumber;
    in_trash: z.ZodBoolean;
    is_pinned: z.ZodBoolean;
    on_favorites: z.ZodBoolean;
    created: z.ZodString;
    hash: z.ZodString;
    deleted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    scale: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    ingredients: string;
    directions: string;
    description: string;
    notes: string;
    nutritional_info: string;
    servings: string;
    prep_time: string;
    cook_time: string;
    total_time: string;
    difficulty: string;
    source: string;
    source_url: string;
    image_url: string | null;
    photo: string | null;
    photo_large: string | null;
    photo_hash: string | null;
    categories: string[];
    rating: number;
    in_trash: boolean;
    is_pinned: boolean;
    on_favorites: boolean;
    created: string;
    hash: string;
    deleted: boolean;
    scale?: string | null | undefined;
}, {
    uid: string;
    name: string;
    ingredients: string;
    directions: string;
    description: string;
    notes: string;
    nutritional_info: string;
    servings: string;
    prep_time: string;
    cook_time: string;
    total_time: string;
    difficulty: string;
    source: string;
    source_url: string;
    image_url: string | null;
    photo: string | null;
    photo_large: string | null;
    photo_hash: string | null;
    categories: string[];
    rating: number;
    in_trash: boolean;
    is_pinned: boolean;
    on_favorites: boolean;
    created: string;
    hash: string;
    deleted?: boolean | undefined;
    scale?: string | null | undefined;
}>;
type Recipe = z.infer<typeof RecipeSchema>;
declare const RecipeInputSchema: z.ZodObject<{
    uid: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    ingredients: z.ZodOptional<z.ZodString>;
    directions: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    nutritional_info: z.ZodOptional<z.ZodString>;
    servings: z.ZodOptional<z.ZodString>;
    prep_time: z.ZodOptional<z.ZodString>;
    cook_time: z.ZodOptional<z.ZodString>;
    total_time: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    source_url: z.ZodOptional<z.ZodString>;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photo_large: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photo_hash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    rating: z.ZodOptional<z.ZodNumber>;
    in_trash: z.ZodOptional<z.ZodBoolean>;
    is_pinned: z.ZodOptional<z.ZodBoolean>;
    on_favorites: z.ZodOptional<z.ZodBoolean>;
    created: z.ZodOptional<z.ZodString>;
    hash: z.ZodOptional<z.ZodString>;
    deleted: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    scale: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    uid?: string | undefined;
    ingredients?: string | undefined;
    directions?: string | undefined;
    description?: string | undefined;
    notes?: string | undefined;
    nutritional_info?: string | undefined;
    servings?: string | undefined;
    prep_time?: string | undefined;
    cook_time?: string | undefined;
    total_time?: string | undefined;
    difficulty?: string | undefined;
    source?: string | undefined;
    source_url?: string | undefined;
    image_url?: string | null | undefined;
    photo?: string | null | undefined;
    photo_large?: string | null | undefined;
    photo_hash?: string | null | undefined;
    categories?: string[] | undefined;
    rating?: number | undefined;
    in_trash?: boolean | undefined;
    is_pinned?: boolean | undefined;
    on_favorites?: boolean | undefined;
    created?: string | undefined;
    hash?: string | undefined;
    deleted?: boolean | undefined;
    scale?: string | null | undefined;
}, {
    name: string;
    uid?: string | undefined;
    ingredients?: string | undefined;
    directions?: string | undefined;
    description?: string | undefined;
    notes?: string | undefined;
    nutritional_info?: string | undefined;
    servings?: string | undefined;
    prep_time?: string | undefined;
    cook_time?: string | undefined;
    total_time?: string | undefined;
    difficulty?: string | undefined;
    source?: string | undefined;
    source_url?: string | undefined;
    image_url?: string | null | undefined;
    photo?: string | null | undefined;
    photo_large?: string | null | undefined;
    photo_hash?: string | null | undefined;
    categories?: string[] | undefined;
    rating?: number | undefined;
    in_trash?: boolean | undefined;
    is_pinned?: boolean | undefined;
    on_favorites?: boolean | undefined;
    created?: string | undefined;
    hash?: string | undefined;
    deleted?: boolean | undefined;
    scale?: string | null | undefined;
}>;
type RecipeInput = z.infer<typeof RecipeInputSchema>;
declare const RecipeListItemSchema: z.ZodObject<{
    uid: z.ZodString;
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    uid: string;
    hash: string;
}, {
    uid: string;
    hash: string;
}>;
type RecipeListItem = z.infer<typeof RecipeListItemSchema>;

declare const CategorySchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    parent_uid: z.ZodNullable<z.ZodString>;
    order_flag: z.ZodNumber;
    deleted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    deleted: boolean;
    parent_uid: string | null;
    order_flag: number;
}, {
    uid: string;
    name: string;
    parent_uid: string | null;
    order_flag: number;
    deleted?: boolean | undefined;
}>;
type Category = z.infer<typeof CategorySchema>;

declare enum MealType {
    Breakfast = 0,
    Lunch = 1,
    Dinner = 2,
    Snack = 3
}
declare const MealSchema: z.ZodObject<{
    uid: z.ZodString;
    recipe_uid: z.ZodNullable<z.ZodString>;
    date: z.ZodString;
    type: z.ZodNumber;
    name: z.ZodString;
    order_flag: z.ZodNumber;
    type_uid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scale: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_ingredient: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    type: number;
    date: string;
    uid: string;
    name: string;
    order_flag: number;
    recipe_uid: string | null;
    is_ingredient: boolean;
    scale?: string | null | undefined;
    type_uid?: string | null | undefined;
}, {
    type: number;
    date: string;
    uid: string;
    name: string;
    order_flag: number;
    recipe_uid: string | null;
    scale?: string | null | undefined;
    type_uid?: string | null | undefined;
    is_ingredient?: boolean | undefined;
}>;
type Meal = z.infer<typeof MealSchema>;
declare const MealTypeSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    order_flag: z.ZodNumber;
    color: z.ZodString;
    export_all_day: z.ZodBoolean;
    export_time: z.ZodNumber;
    original_type: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    order_flag: number;
    color: string;
    export_all_day: boolean;
    export_time: number;
    original_type: number;
}, {
    uid: string;
    name: string;
    order_flag: number;
    color: string;
    export_all_day: boolean;
    export_time: number;
    original_type: number;
}>;
type MealTypeEntity = z.infer<typeof MealTypeSchema>;

declare const PantryItemSchema: z.ZodObject<{
    uid: z.ZodString;
    ingredient: z.ZodString;
    quantity: z.ZodString;
    aisle: z.ZodString;
    purchase_date: z.ZodString;
    expiration_date: z.ZodNullable<z.ZodString>;
    in_stock: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    uid: string;
    ingredient: string;
    quantity: string;
    aisle: string;
    purchase_date: string;
    expiration_date: string | null;
    in_stock: boolean;
}, {
    uid: string;
    ingredient: string;
    quantity: string;
    aisle: string;
    purchase_date: string;
    expiration_date: string | null;
    in_stock: boolean;
}>;
type PantryItem = z.infer<typeof PantryItemSchema>;

declare const GroceryItemSchema: z.ZodObject<{
    uid: z.ZodString;
    recipe_uid: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    order_flag: z.ZodNumber;
    purchased: z.ZodBoolean;
    aisle: z.ZodString;
    ingredient: z.ZodString;
    recipe: z.ZodNullable<z.ZodString>;
    instruction: z.ZodString;
    quantity: z.ZodString;
    separate: z.ZodBoolean;
    aisle_uid: z.ZodNullable<z.ZodString>;
    list_uid: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    order_flag: number;
    recipe_uid: string | null;
    ingredient: string;
    quantity: string;
    aisle: string;
    purchased: boolean;
    recipe: string | null;
    instruction: string;
    separate: boolean;
    aisle_uid: string | null;
    list_uid: string | null;
}, {
    uid: string;
    name: string;
    order_flag: number;
    recipe_uid: string | null;
    ingredient: string;
    quantity: string;
    aisle: string;
    purchased: boolean;
    recipe: string | null;
    instruction: string;
    separate: boolean;
    aisle_uid: string | null;
    list_uid: string | null;
}>;
type GroceryItem = z.infer<typeof GroceryItemSchema>;
declare const GroceryListSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    order_flag: z.ZodNumber;
    is_default: z.ZodBoolean;
    reminders_list: z.ZodString;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    order_flag: number;
    is_default: boolean;
    reminders_list: string;
}, {
    uid: string;
    name: string;
    order_flag: number;
    is_default: boolean;
    reminders_list: string;
}>;
type GroceryList = z.infer<typeof GroceryListSchema>;
declare const GroceryAisleSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    order_flag: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    order_flag: number;
}, {
    uid: string;
    name: string;
    order_flag: number;
}>;
type GroceryAisle = z.infer<typeof GroceryAisleSchema>;
declare const GroceryIngredientSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    aisle_uid: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    aisle_uid: string | null;
}, {
    uid: string;
    name: string;
    aisle_uid: string | null;
}>;
type GroceryIngredient = z.infer<typeof GroceryIngredientSchema>;

declare const MenuSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    notes: z.ZodString;
    order_flag: z.ZodNumber;
    days: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    notes: string;
    order_flag: number;
    days: number;
}, {
    uid: string;
    name: string;
    notes: string;
    order_flag: number;
    days: number;
}>;
type Menu = z.infer<typeof MenuSchema>;
declare const MenuItemSchema: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodString;
    order_flag: z.ZodNumber;
    recipe_uid: z.ZodNullable<z.ZodString>;
    menu_uid: z.ZodString;
    type_uid: z.ZodNullable<z.ZodString>;
    day: z.ZodNumber;
    scale: z.ZodNullable<z.ZodString>;
    is_ingredient: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    uid: string;
    name: string;
    scale: string | null;
    order_flag: number;
    recipe_uid: string | null;
    type_uid: string | null;
    is_ingredient: boolean;
    menu_uid: string;
    day: number;
}, {
    uid: string;
    name: string;
    scale: string | null;
    order_flag: number;
    recipe_uid: string | null;
    type_uid: string | null;
    is_ingredient: boolean;
    menu_uid: string;
    day: number;
}>;
type MenuItem = z.infer<typeof MenuItemSchema>;

declare const BookmarkSchema: z.ZodObject<{
    uid: z.ZodString;
    recipe_uid: z.ZodString;
    order_flag: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: string;
    order_flag: number;
    recipe_uid: string;
}, {
    uid: string;
    order_flag: number;
    recipe_uid: string;
}>;
type Bookmark = z.infer<typeof BookmarkSchema>;

declare const SyncStatusSchema: z.ZodObject<{
    categories: z.ZodNumber;
    recipes: z.ZodNumber;
    photos: z.ZodNumber;
    groceries: z.ZodNumber;
    grocerylists: z.ZodNumber;
    groceryaisles: z.ZodNumber;
    groceryingredients: z.ZodNumber;
    meals: z.ZodNumber;
    mealtypes: z.ZodNumber;
    bookmarks: z.ZodNumber;
    pantry: z.ZodNumber;
    pantrylocations: z.ZodNumber;
    menus: z.ZodNumber;
    menuitems: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    categories: number;
    recipes: number;
    photos: number;
    groceries: number;
    grocerylists: number;
    groceryaisles: number;
    groceryingredients: number;
    meals: number;
    mealtypes: number;
    bookmarks: number;
    pantry: number;
    pantrylocations: number;
    menus: number;
    menuitems: number;
}, {
    categories: number;
    recipes: number;
    photos: number;
    groceries: number;
    grocerylists: number;
    groceryaisles: number;
    groceryingredients: number;
    meals: number;
    mealtypes: number;
    bookmarks: number;
    pantry: number;
    pantrylocations: number;
    menus: number;
    menuitems: number;
}>;
type SyncStatus = z.infer<typeof SyncStatusSchema>;

declare class RecipeService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<RecipeListItem[]>;
    get(uid: string): Promise<Recipe>;
    save(recipe: RecipeInput): Promise<{
        uid: string;
    }>;
    delete(uid: string, permanent?: boolean): Promise<void>;
    private computeHash;
}

declare class CategoryService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<Category[]>;
    create(name: string, parentUid?: string): Promise<{
        uid: string;
    }>;
    update(uid: string, updates: Partial<Pick<Category, 'name' | 'parent_uid'>>): Promise<void>;
    nest(childUid: string, parentUid: string): Promise<void>;
    rename(uid: string, name: string): Promise<void>;
    delete(uid: string): Promise<void>;
}

declare class MealService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<Meal[]>;
    add(recipeUid: string, date: string, type?: MealType, name?: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class PantryService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<PantryItem[]>;
    add(ingredient: string, quantity?: string, aisle?: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class GroceryService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<GroceryItem[]>;
    delete(uid: string): Promise<void>;
    clear(): Promise<number>;
}

declare class PhotoService {
    private client;
    private recipeService;
    constructor(client: PaprikaHttpClient, recipeService: RecipeService);
    upload(recipeUid: string, imagePath: string): Promise<{
        photoUid: string;
        photoLargeUid: string;
    }>;
}

declare class GroceryListService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<GroceryList[]>;
    create(name: string, isDefault?: boolean): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class GroceryAisleService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<GroceryAisle[]>;
    create(name: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class MealTypeService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<MealTypeEntity[]>;
    create(name: string, color?: string, exportTime?: number, exportAllDay?: boolean): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class MenuService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<Menu[]>;
    create(name: string, days?: number, notes?: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class MenuItemService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<MenuItem[]>;
    add(menuUid: string, day: number, name: string, recipeUid?: string, typeUid?: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class BookmarkService {
    private client;
    constructor(client: PaprikaHttpClient);
    list(): Promise<Bookmark[]>;
    add(recipeUid: string): Promise<{
        uid: string;
    }>;
    delete(uid: string): Promise<void>;
}

declare class StatusService {
    private client;
    constructor(client: PaprikaHttpClient);
    get(): Promise<SyncStatus>;
}

declare class PaprikaError extends Error {
    cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
declare class AuthError extends PaprikaError {
    constructor(message?: string);
}
declare class NotFoundError extends PaprikaError {
    resourceType: string;
    uid: string;
    constructor(resourceType: string, uid: string);
}
declare class ApiError extends PaprikaError {
    statusCode: number;
    body: unknown;
    constructor(statusCode: number, body: unknown);
}
declare class NetworkError extends PaprikaError {
    constructor(message: string, cause?: Error);
}
declare class ValidationError extends PaprikaError {
    details?: unknown | undefined;
    constructor(message: string, details?: unknown | undefined);
}

declare class PaprikaClient {
    readonly recipes: RecipeService;
    readonly categories: CategoryService;
    readonly meals: MealService;
    readonly pantry: PantryService;
    readonly groceries: GroceryService;
    readonly photos: PhotoService;
    readonly groceryLists: GroceryListService;
    readonly groceryAisles: GroceryAisleService;
    readonly mealTypes: MealTypeService;
    readonly menus: MenuService;
    readonly menuItems: MenuItemService;
    readonly bookmarks: BookmarkService;
    readonly status: StatusService;
    constructor(config: PaprikaConfig);
}

export { ApiError, AuthError, type Bookmark, BookmarkSchema, type Category, CategorySchema, type GroceryAisle, GroceryAisleSchema, type GroceryIngredient, GroceryIngredientSchema, type GroceryItem, GroceryItemSchema, type GroceryList, GroceryListSchema, type Meal, MealSchema, MealType, type MealTypeEntity, MealTypeSchema, type Menu, type MenuItem, MenuItemSchema, MenuSchema, NetworkError, NotFoundError, type PantryItem, PantryItemSchema, PaprikaClient, type PaprikaConfig, PaprikaConfigSchema, PaprikaError, type Recipe, type RecipeInput, RecipeInputSchema, type RecipeListItem, RecipeListItemSchema, RecipeSchema, type SyncStatus, SyncStatusSchema, ValidationError, configFromEnv, configFromSops, resolveConfig };
