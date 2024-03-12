import { Route } from '@angular/router';

import { AuthenticatedGuard } from '../core/auth/authenticated.guard';
import { I18nBreadcrumbResolver } from '../core/breadcrumbs/i18n-breadcrumb.resolver';
import { provideSubmission } from '../submission/provide-submission';
import { ThemedSubmissionSubmitComponent } from '../submission/submit/themed-submission-submit.component';

export const ROUTES: Route[] = [
  {
    canActivate: [AuthenticatedGuard],
    path: '',
    pathMatch: 'full',
    component: ThemedSubmissionSubmitComponent,
    resolve: {
      breadcrumb: I18nBreadcrumbResolver,
    },
    providers: [
      provideSubmission(),
    ],
    data: { title: 'submission.submit.title', breadcrumbKey: 'submission.submit' },
  },
];
