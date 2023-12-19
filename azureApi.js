const axios = require('axios');

const tenant_id = 'abcd1234-1234-1234-1234-1234567890ab'
const client_id = 'abcd1234-1234-1234-1234-1234567890ab'
const client_secret = 'abcd1234-1234-1234-1234-1234567890ab'

const endpoint = 'https://login.microsoftonline.com/' + tenant_id + '/oauth2/v2.0/token';
const ARM_ENDPOINT = 'https://management.azure.com';
const GRAPH_ENDPOINT = 'https://graph.microsoft.com';

const getToken = async (scope) => {
  const data = {
    'grant_type': 'client_credentials',
    'client_id': client_id,
    'client_secret': client_secret,
    'scope': `${scope}/.default`
  };

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const response = await axios.post(endpoint, data, { headers: headers });
  return response.data.access_token;
};

const getGraphToken = () => getToken(GRAPH_ENDPOINT);
const getAzureManagementToken = () => getToken(ARM_ENDPOINT);


const createUserInAzureAD = async (user) => {
  try {
    const token = await getGraphToken();

    // Create user using Microsoft Graph API
    const createUserResponse = await axios.post(`${GRAPH_ENDPOINT}/v1.0/users`, user, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return createUserResponse.data; // Returns the created user data
  } catch (error) {

    throw error;
  }
};

const deleteUserInAzureAD = async (user_id) => {
  try {

    const token = await getGraphToken();
    const deletedUserResponse = await axios.delete(`${GRAPH_ENDPOINT}/v1.0/users/${user_id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return deletedUserResponse.data;
  } catch (error) {
    throw error;
  }
}

const createResourceGroup = async (subscriptionId, resourceGroupName, location) => {
  try {
    const token = await getAzureManagementToken();

    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}?api-version=2021-04-01`
    const createResourceGroupResponse = await axios.put(url,
      {
        location: location
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return createResourceGroupResponse.data; // Returns the created resource group data
  } catch (error) {
    console.error('Error createResourceGroup', error.response ? error.response.data : error.message);
    throw error;
  }
};

const deleteResourceGroup = async (subscriptionId, resourceGroupName) => {
  try {
    const token = await getAzureManagementToken();
    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}?api-version=2021-04-01`
    console.log('url')
    const deleteResourceGroupResponse = await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return deleteResourceGroupResponse.data; // Returns the created resource group data

  } catch (error) {
    console.error('Error deleteResourceGroup', error.response ? error.response.data : error.message);
    throw error;
  }
};

const createOrUpdateOpenAIResource = async (subscriptionId, resourceGroupName, resourceName, location) => {
  try {
    const token = await getAzureManagementToken();

    const resourceType = 'Microsoft.CognitiveServices/accounts';
    const apiVersion = '2021-04-30';
    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${resourceType}/${resourceName}?api-version=${apiVersion}`;

    const createOrUpdateResponse = await axios.put(
      url,
      {
        kind: 'OpenAI',
        sku: {
          name: 'S0'
        },
        location: location
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return createOrUpdateResponse.data;
  } catch (error) {
    console.error('Error createOrUpdateOpenAIResource', error.response ? error.response.data : error.message);
    throw error;
  }
};

const deleteResource = async (subscriptionId, resourceGroupName, resourceName) => {
  try {
    const token = await getAzureManagementToken();
    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.CognitiveServices/accounts/${resourceName}?api-version=2021-04-30`
    const deleteResourceResponse = await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return deleteResourceResponse.data; // Returns the created resource group data
  } catch (error) {
    console.error('Error deleteResource', error.response ? error.response.data : error.message);
    throw error;
  }
};

const getRoleDefinitionId = async (roleName) => {
  try {
    const accessToken = await getGraphToken();

    // Query Microsoft Graph API to get role definition ID
    const graphApiUrl = `${GRAPH_ENDPOINT}/v1.0/myOrganization/roleManagement/directory/roleDefinitions?$filter=displayName eq '${roleName}'`;
    const response = await axios.get(graphApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const roleDefinitionId = response.data;
    return roleDefinitionId;
  } catch (error) {
    console.error('Error getting role definition ID:', error.response ? error.response.data : error.message);
    throw error;
  }
}

const grantAccessToUserResourceGroup = async (principalId, subscriptionId, resourceGroupName, roleAssignmentId) => {

  const roleDefinitionId = `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleAssignmentId}`;

  try {
    const scope = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}`;
    const url = `${ARM_ENDPOINT}/${scope}/providers/Microsoft.Authorization/roleAssignments/${roleAssignmentId}?api-version=2022-04-01`;

    const reqBody = {
      "properties": {
        "roleDefinitionId": `${roleDefinitionId}`,
        "principalId": principalId
      }
    };

    // Add the role assignment
    const accessToken = await getAzureManagementToken();
    const roleAssignmentResponse = await axios.put(url, reqBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Role assignment added successfully to resource group: ${resourceGroupName}`, roleAssignmentResponse.data);
    return roleAssignmentResponse.data;
  } catch (error) {
    console.error('grantAccessToUserResourceGroup Error adding role assignment:', error.response ? error.response.data : error.message);
    throw error;
  }
};

const grantAccessToUserToResource = async (principalId, subscriptionId, resourceGroupName, resourceName, provider, roleAssignmentId) => {
  try {
    const scope = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${provider}/${resourceName}`;
    const url = `${ARM_ENDPOINT}/${scope}/providers/Microsoft.Authorization/roleAssignments/${roleAssignmentId}?api-version=2022-04-01`
    const roleDefinitionId = `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleAssignmentId}`;
    reqBody = {
      "properties": {
        "roleDefinitionId": roleDefinitionId,
        "principalId": principalId
      }
    }

    const accessToken = await getAzureManagementToken();
    // Add the role assignment
    const roleAssignmentResponse = await axios.put(url, reqBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Role assignment added successfully to resource ${scope}  `, roleAssignmentResponse.data);
    return roleAssignmentResponse.data;
  } catch (error) {
    console.error('grantAccessToUserToResource Error adding role assignment:', error.response ? error.response.data : error.message);
    throw error;
  }
};

const createBudgetInResourceGroup = async ({ subscriptionId, resourceGroupName, budgetName, amount, currency, thresholdPercentage }) => {
  try {
    const token = await getAzureManagementToken();
    const API_VERSION = '2019-10-01';
    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Consumption/budgets/${budgetName}?api-version=${API_VERSION}`;

    let today = new Date();
    const startDate = `${today.getFullYear()}-${today.getMonth() + 1}-01`;

    // Set if after 3 months from start date
    today.setMonth(today.getMonth() + 3);
    const endDate = today.toISOString().split('T')[0];
    // const endDate = '2099-12-31';

    const createBudgetResponse = await axios.put(
      url,
      {
        properties: {
          amount,
          category: 'Cost',
          timeGrain: 'Monthly',
          timePeriod: { startDate, endDate },
          budgetFilter: {
            and: [
              {
                dimensions: { resourceGroupName }
              }
            ]
          },
          thresholds: { percentage: thresholdPercentage },
          currency
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return createBudgetResponse.data;
  } catch (error) {
    console.error('Error creating budget', error.response ? error.response.data : error.message);
    throw error;
  }
};

const getBudgetUsage = async (subscriptionId, resourceGroupName, budgetName) => {
  try {
    const token = await getAzureManagementToken();

    const url = `${ARM_ENDPOINT}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Consumption/budgets/${budgetName}?api-version=2023-05-01`;
    const getBudgetUsageResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return getBudgetUsageResponse.data;
  } catch (error) {
    console.error('Error getBudgetUsage', error.response ? error.response.data : error.message);
    throw error;
  }
};

const SUBSCRIPTION_ID = 'yourSubscriptionId';
const RESOURCE_GROUP_NAME = 'yourResourceGroupName';
const RESOURCE_GROUP_LOCATION = 'eastus2';
const RESOURCE_NAME = 'your-openai-resource-test-v4';
const BUDGET_NAME = 'your-budget-name';
const BUDGET_AMOUNT = 100;
const BUDGET_CURRENCY = 'INR';
const BUDGET_THRESHOLD_PERCENTAGE = 80;
const PRINCIPAL_ID = 'yourPrincipalId';
const ROLE_ASSIGNMENT_ID = 'abcd1234-1234-1234-1234-1234567890ab';
const PROVIDER = 'Microsoft.CognitiveServices/accounts';
const CONTRIBUTOR_ROLE_ASSIGNMENT_ID = 'abcd1234-1234-1234-1234-1234567890ab';

const main = async () => {
  try {
    const createdResourceGroup = await createResourceGroup(SUBSCRIPTION_ID, RESOURCE_GROUP_NAME, RESOURCE_GROUP_LOCATION);
    console.log('Resource group created successfully:', createdResourceGroup);

    const result = await createOrUpdateOpenAIResource(SUBSCRIPTION_ID, RESOURCE_GROUP_NAME, RESOURCE_NAME, RESOURCE_GROUP_LOCATION);
    console.log('Azure OpenAI Resource created or updated successfully:', result);

    const deleteResourceResponse = await deleteResource(SUBSCRIPTION_ID, RESOURCE_GROUP_NAME, RESOURCE_NAME);
    console.log(`Azure OpenAI Resource ${RESOURCE_GROUP_NAME} deleted successfully:`, deleteResourceResponse);

    const deleteResourceGroupResponse = await deleteResourceGroup(SUBSCRIPTION_ID, RESOURCE_GROUP_NAME);
    console.log('Resource group deleted successfully:', deleteResourceGroupResponse);

    const budget = await createBudgetInResourceGroup({
      subscriptionId: SUBSCRIPTION_ID,
      resourceGroupName: RESOURCE_GROUP_NAME,
      budgetName: BUDGET_NAME,
      amount: BUDGET_AMOUNT,
      currency: BUDGET_CURRENCY,
      thresholdPercentage: BUDGET_THRESHOLD_PERCENTAGE
    });

    console.log('Budget created successfully:', budget);

    const budgetResult = await getBudgetUsage(SUBSCRIPTION_ID, RESOURCE_GROUP_NAME, BUDGET_NAME);
    console.log('budget usage:', budgetResult);

    const roleDefinitionId = await getRoleDefinitionId('Contributor')
    console.log('roleDefinitionId', roleDefinitionId)

    const userToCreate = {
      accountEnabled: true,
      displayName: 'Test User2',
      mailNickname: 'testuser2',
      userPrincipalName: 'test.user2@anydomain.com',
      passwordProfile: {
        password: 'YourStrongPassword123!',
        forceChangePasswordNextSignIn: false,
        forceChangePasswordNextSignInWithMfa: false
      }
    };

    const createdUser = await createUserInAzureAD(userToCreate);
    console.log('User created successfully:', createdUser);

    const resp = await grantAccessToUserResourceGroup(
      PRINCIPAL_ID,
      SUBSCRIPTION_ID,
      RESOURCE_GROUP_NAME,
      ROLE_ASSIGNMENT_ID
    );
    console.log("resp", resp)

    const resp2 = await grantAccessToUserToResource(
      PRINCIPAL_ID,
      SUBSCRIPTION_ID,
      RESOURCE_GROUP_NAME,
      RESOURCE_NAME,
      PROVIDER,
      CONTRIBUTOR_ROLE_ASSIGNMENT_ID
    );

    console.log("resp2", resp2)

    const deletedUser = await deleteUserInAzureAD(createdUser.id);
    console.log('User deleted successfully:', deletedUser);

  } catch (error) {
    console.log('Error: in some of Azure APIs', error.response ? error.response.data : error.message);
    console.error('Error:', error.message);
  }

};

main();
