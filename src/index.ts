import { PaprikaConfig, PaprikaConfigSchema } from './config';
import { BasicAuth, JwtAuth } from './client/auth';
import { PaprikaHttpClient } from './client/http';
import {
  RecipeService,
  CategoryService,
  MealService,
  PantryService,
  GroceryService,
  PhotoService,
} from './services';

export class PaprikaClient {
  readonly recipes: RecipeService;
  readonly categories: CategoryService;
  readonly meals: MealService;
  readonly pantry: PantryService;
  readonly groceries: GroceryService;
  readonly photos: PhotoService;

  constructor(config: PaprikaConfig) {
    const validated = PaprikaConfigSchema.parse(config);

    const basicAuth = new BasicAuth(validated.email, validated.password);
    const jwtAuth = new JwtAuth(validated.email, validated.password, validated.apiBaseUrl);
    const httpClient = new PaprikaHttpClient(basicAuth, jwtAuth, validated.apiBaseUrl);

    this.recipes = new RecipeService(httpClient);
    this.categories = new CategoryService(httpClient);
    this.meals = new MealService(httpClient);
    this.pantry = new PantryService(httpClient);
    this.groceries = new GroceryService(httpClient);
    this.photos = new PhotoService(httpClient, this.recipes);
  }
}

// Re-export types and utilities
export * from './types';
export * from './errors';
export * from './config';
export { MealType } from './types/meal';
