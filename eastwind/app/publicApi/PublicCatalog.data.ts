import type { Lite } from "@altea/altea/data/lite";
import type { CategoryEntity, ProductEntity } from "../products/Product.data";

// The wire shape of the ANONYMOUS public catalog, shared by the server and PublicCatalog.tsx.
//
// It lives in the DATA layer because both halves need it and the client may not reference `server/` — the
// same call @altea/altea-whats-new makes for its DTOs. Nothing here is an entity of its own: `category` and
// `products` ARE real entities/lites, which the client's `Serializer.parse` revives (`ajaxGet` deserializes
// with the Serializer by default), and `picture` is base64 because a `FileEmbedded.binaryFile` is a
// `Uint8Array` the wire has no place for.
export interface CategoryWithProducts {
    category: Lite<CategoryEntity>;
    /** The category picture's bytes, base64, rendered as a data: url. */
    picture: string | null;
    /**
     * The picture's media type, for that data: url. Read rather than hard-coded as `image/jpeg`:
     * eastwind's category pictures come off disk (terminal/northwind/image_categories) with the extension the file
     * actually has — today PNG — so the type has to travel with the bytes.
     */
    pictureMimeType: string | null;
    locCategoryName: string;
    locDescription: string;
    products: ProductEntity[];
}
