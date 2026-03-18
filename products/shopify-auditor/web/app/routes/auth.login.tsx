import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { AppProvider, Page, Card, FormLayout, TextField, Button, Text, BlockStack } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import shopify from "~/lib/shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await shopify.login(request);
  return json({
    errors,
    polarisTranslations: require("@shopify/polaris/locales/en.json"),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await shopify.login(request);
  return json({ errors, polarisTranslations: {} });
};

export default function AuthLogin() {
  const { errors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const shopError = actionData?.errors?.shop ?? errors?.shop;

  return (
    <AppProvider i18n={{}}>
      <Page>
        <Card>
          <Form method="post">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Log in</Text>
              <FormLayout>
                <TextField
                  type="text"
                  name="shop"
                  label="Shop domain"
                  helpText="e.g. my-shop.myshopify.com"
                  autoComplete="on"
                  error={shopError === "MISSING_SHOP" ? "Please enter your shop domain" : shopError === "INVALID_SHOP" ? "Please enter a valid shop domain" : undefined}
                />
                <Button submit variant="primary">Log in</Button>
              </FormLayout>
            </BlockStack>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
