-- Listing-image A/B test: which version of the product page ('a' cover only, 'b' image gallery) a visitor saw.
ALTER TABLE events ADD COLUMN variant TEXT;
ALTER TABLE orders ADD COLUMN variant TEXT;
