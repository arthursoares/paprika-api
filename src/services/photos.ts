import { randomUUID, createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import type { PaprikaHttpClient } from '../client/http';
import { RecipeService } from './recipes';
import { ValidationError } from '../errors';

export class PhotoService {
  constructor(
    private client: PaprikaHttpClient,
    private recipeService: RecipeService,
  ) {}

  async upload(
    recipeUid: string,
    imagePath: string,
  ): Promise<{ photoUid: string; photoLargeUid: string }> {
    if (!existsSync(imagePath)) {
      throw new ValidationError(`Image file not found: ${imagePath}`);
    }

    const recipe = await this.recipeService.get(recipeUid);

    // Read original for full-size
    const photoLargeData = readFileSync(imagePath);

    // Create 500x500 thumbnail
    const thumbPath = `/tmp/paprika_thumb_${Date.now()}.jpg`;
    try {
      execSync(
        `convert "${imagePath}" -gravity center -crop 1:1 -resize 500x500 -quality 85 "${thumbPath}"`,
        { stdio: 'pipe' },
      );
    } catch {
      execSync(
        `convert "${imagePath}" -resize 500x500^ -gravity center -extent 500x500 -quality 85 "${thumbPath}"`,
        { stdio: 'pipe' },
      );
    }
    const photoThumbData = readFileSync(thumbPath);
    unlinkSync(thumbPath);

    const photoUid = randomUUID().toUpperCase();
    const photoLargeUid = randomUUID().toUpperCase();

    // Step 1: Upload full-size to /photo/ endpoint
    await this.client.request({
      method: 'POST',
      endpoint: `/photo/${photoLargeUid}/`,
      apiVersion: 'v2',
      data: {
        uid: photoLargeUid,
        hash: createHash('sha256').update(photoLargeData).digest('hex').toUpperCase(),
        recipe_uid: recipeUid,
        filename: `${photoLargeUid}.jpg`,
        name: '1',
        order_flag: 0,
        deleted: false,
      },
      files: [
        {
          name: 'photo_upload',
          filename: `${photoLargeUid}.jpg`,
          contentType: 'image/jpeg',
          data: photoLargeData,
        },
      ],
    });

    // Step 2: Sync recipe with thumbnail
    const updatedRecipe = {
      ...recipe,
      photo: `${photoUid}.jpg`,
      photo_large: `${photoLargeUid}.jpg`,
      photo_hash: createHash('sha256').update(photoThumbData).digest('hex').toUpperCase(),
      hash: '', // Will be recalculated
    };
    updatedRecipe.hash = createHash('sha256').update(JSON.stringify(updatedRecipe)).digest('hex').toUpperCase();

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${recipeUid}/`,
      apiVersion: 'v2',
      data: updatedRecipe,
      files: [
        {
          name: 'photo_upload',
          filename: `${photoUid}.jpg`,
          contentType: 'image/jpeg',
          data: photoThumbData,
        },
      ],
    });

    return { photoUid, photoLargeUid };
  }
}
