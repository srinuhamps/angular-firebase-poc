import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();

  readonly services = [
    { label: 'Knotless Box Braids', path: '/services' },
    { label: 'Goddess Locs',        path: '/services' },
    { label: 'Bohemian Twists',     path: '/services' },
    { label: 'Sew-In Weave',        path: '/services' },
    { label: 'Kids Styles',         path: '/services' },
    { label: 'Consultation',        path: '/services' },
  ];

  readonly quickLinks = [
    { label: 'Home',        path: '/'         },
    { label: 'Services',    path: '/services' },
    { label: 'Products',    path: '/products' },
    { label: 'About Us',    path: '/about'    },
    { label: 'Gallery',     path: '/gallery'  },
    { label: 'Contact',     path: '/contact'  },
    { label: 'Book Now',    path: '/booking'  },
  ];
}
