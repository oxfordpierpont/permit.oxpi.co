# Road Ready Permit Practice

Road Ready Permit Practice is a gamified Georgia Class CP learner-permit study app. It includes a visual sign manual, sign-matching drills, road-rule drills, mock exams, and locally bundled rendered MUTCD sign artwork.

## Deployment

The app is a static Nginx site packaged by the included `Dockerfile` for direct Dokploy deployment. Its production domain is `https://permit.oxpi.co`.

The Docker image contains only the runtime application, asphalt texture, and verified sign catalog. The catalog source and audit scripts remain in the repository for maintenance but are deliberately excluded from the image.

No GitHub Actions workflow is used for deployment.
