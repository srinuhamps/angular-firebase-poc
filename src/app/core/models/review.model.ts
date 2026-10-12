export interface Review {
  author: string;
  rating: number;
  text: string;
  relativeDate: string;
  date: string;
}

export interface ReviewSummary {
  name: string;
  rating: number;
  totalReviews: number;
  reviews: Review[];
}
